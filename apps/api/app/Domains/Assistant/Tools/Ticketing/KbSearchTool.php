<?php

namespace App\Domains\Assistant\Tools\Ticketing;

use App\Domains\Assistant\Tools\AssistantTool;
use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\Ticketing\Models\SdKbArticle;
use App\Models\User;
use App\Support\ListQuery;
use Illuminate\Support\Str;

final class KbSearchTool implements AssistantTool
{
    public function name(): string
    {
        return 'kb_search';
    }

    public function description(): string
    {
        return 'Search published knowledge base articles by keyword. Returns a short excerpt per article.';
    }

    public function permission(): string
    {
        return OrgPermissionCatalog::KB_VIEW;
    }

    public function writes(): bool
    {
        return false;
    }

    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:200'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:10'],
        ];
    }

    public function run(array $input, User $actor): array
    {
        $query = SdKbArticle::query()->where('is_published', true);

        if (filled($input['q'] ?? null)) {
            $pattern = ListQuery::likePattern(trim((string) $input['q']));
            $query->where(function ($builder) use ($pattern): void {
                $builder->where('summary', 'like', $pattern)->orWhere('description', 'like', $pattern);
            });
        }

        $articles = $query->latest()->limit((int) ($input['limit'] ?? 5))->get();

        return [
            'articles' => $articles->map(static fn (SdKbArticle $article): array => [
                'id' => $article->id,
                'number' => $article->number,
                'summary' => $article->summary,
                'excerpt' => Str::limit(strip_tags((string) $article->description), 600),
            ])->values()->all(),
            'content_note' => AssistantTool::UNTRUSTED_TEXT_NOTE,
        ];
    }

    public function summarize(array $input): string
    {
        return '';
    }
}
