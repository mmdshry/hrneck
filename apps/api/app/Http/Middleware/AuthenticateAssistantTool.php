<?php

namespace App\Http\Middleware;

use App\Domains\Assistant\Models\AssistantConversation;
use App\Domains\Assistant\Support\AssistantRequestContext;
use App\Domains\Assistant\Support\ConversationToken;
use App\Domains\Assistant\Support\CopilotStudioSettings;
use App\Domains\IdentityAccess\Support\SignInEligibility;
use App\Models\Tenant;
use App\Models\User;
use App\Support\StaffTenant;
use Closure;
use Illuminate\Http\Request;
use Stancl\Tenancy\Tenancy;
use Symfony\Component\HttpFoundation\Response;

/**
 * Authenticates a tool call from the Copilot Studio connector.
 *
 * Two credentials are required: the connector API key (proves the caller is our agent) and the
 * conversation token (proves which user started the conversation). The tenant and the acting user
 * come only from the conversation row, never from request headers or the request body.
 *
 * The conversation token is read from the X-Assistant-Token header, or from the assistant_token JSON
 * body field when the header is absent. Copilot Studio cannot bind a connector header to a topic
 * variable, so the topic sends the token in the body instead. Both paths use the same signed check.
 */
class AuthenticateAssistantTool
{
    public const CONTEXT_ATTRIBUTE = 'assistant_context';

    /**
     * Body fields that carry the conversation token. Copilot Studio hides connector fields whose names
     * contain "token", so the connector sends conversation_ref. assistant_token is accepted as a fallback.
     *
     * @var list<string>
     */
    public const BODY_TOKEN_FIELDS = ['conversation_ref', 'assistant_token'];

    public function __construct(
        private readonly Tenancy $tenancy,
        private readonly CopilotStudioSettings $settings,
        private readonly SignInEligibility $eligibility,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $expectedKey = $this->settings->connectorApiKey();
        $providedKey = (string) $request->header('X-Assistant-Api-Key', '');
        if ($expectedKey === '' || ! hash_equals($expectedKey, $providedKey)) {
            abort(401, 'Invalid assistant connector key.');
        }

        $conversationId = ConversationToken::conversationIdFrom($this->conversationTokenFrom($request));
        if ($conversationId === null) {
            abort(401, 'Invalid assistant token.');
        }

        $conversation = AssistantConversation::query()->find($conversationId);
        if ($conversation === null || ! $conversation->isUsable()) {
            abort(401, 'Assistant conversation has ended.');
        }

        $user = User::query()->find($conversation->user_id);
        if ($user === null || $this->eligibility->blockReason($user, viaPassword: false) !== null) {
            abort(401, 'Assistant user is not active.');
        }

        // Platform staff are never tenant members. They may use a conversation they started while acting in
        // the tenant, and then the tools run with the staff permissions for that tenant.
        $isMember = $user->belongsToTenant($conversation->tenant_id);
        $isActingStaff = ! $isMember && $user->isPlatformStaff();
        if (! $isMember && ! $isActingStaff) {
            abort(403, 'You do not belong to this organization.');
        }

        $tenant = Tenant::query()->find($conversation->tenant_id);
        if ($tenant === null) {
            abort(401, 'Assistant tenant no longer exists.');
        }

        $this->tenancy->initialize($tenant);
        setPermissionsTeamId($tenant->id);
        if ($isActingStaff) {
            StaffTenant::markRequest($request, (string) $tenant->id);
        }
        $request->setUserResolver(static fn (): User => $user);
        $request->attributes->set(self::CONTEXT_ATTRIBUTE, new AssistantRequestContext(
            conversation: $conversation,
            user: $user,
            tenantId: (string) $tenant->id,
        ));

        try {
            return $next($request);
        } finally {
            setPermissionsTeamId(null);
            $this->tenancy->end();
        }
    }

    private function conversationTokenFrom(Request $request): string
    {
        $header = (string) $request->header('X-Assistant-Token', '');
        if ($header !== '') {
            return $header;
        }

        foreach (self::BODY_TOKEN_FIELDS as $field) {
            $bodyToken = $request->json($field);
            if (is_string($bodyToken) && $bodyToken !== '') {
                return $bodyToken;
            }
        }

        return '';
    }
}
