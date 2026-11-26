<?php

namespace App\Domains\Assistant\Tools;

use App\Domains\Assistant\Tools\Ticketing\KbSearchTool;
use App\Domains\Assistant\Tools\Ticketing\TicketAddNoteTool;
use App\Domains\Assistant\Tools\Ticketing\TicketCreateTool;
use App\Domains\Assistant\Tools\Ticketing\TicketDesksTool;
use App\Domains\Assistant\Tools\Ticketing\TicketShowTool;
use App\Domains\Assistant\Tools\Ticketing\TicketsSearchTool;
use App\Domains\Assistant\Tools\Training\TrainingCampaignSummaryTool;
use App\Models\User;
use Illuminate\Container\Container;

/**
 * Every tool the assistant knows about. Only tools the user's permissions allow are ever offered or run.
 */
final class AssistantToolRegistry
{
    /** @var list<class-string<AssistantTool>> */
    private const TOOL_CLASSES = [
        TicketsSearchTool::class,
        TicketShowTool::class,
        TicketDesksTool::class,
        KbSearchTool::class,
        TrainingCampaignSummaryTool::class,
        TicketCreateTool::class,
        TicketAddNoteTool::class,
    ];

    /** @var array<string, AssistantTool> */
    private array $tools = [];

    public function __construct(private readonly Container $container)
    {
        foreach (self::TOOL_CLASSES as $toolClass) {
            $tool = $this->container->make($toolClass);
            $this->tools[$tool->name()] = $tool;
        }
    }

    public function find(string $name): ?AssistantTool
    {
        return $this->tools[$name] ?? null;
    }

    /**
     * @return list<AssistantTool>
     */
    public function allowedFor(User $user): array
    {
        return array_values(array_filter(
            $this->tools,
            static fn (AssistantTool $tool): bool => $user->canAny([$tool->permission()]),
        ));
    }
}
