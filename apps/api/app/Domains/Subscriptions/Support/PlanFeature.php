<?php

namespace App\Domains\Subscriptions\Support;

enum PlanFeature: string
{
    case CustomDomains = 'custom_domains';
    case AdvancedReporting = 'advanced_reporting';
    case WhiteLabel = 'white_label';
    case LearnerPortal = 'learner_portal';
    case Training = 'training';
    case Ticketing = 'ticketing';
    case Checklists = 'checklists';
    case KnowledgeBase = 'knowledge_base';

    public function label(): string
    {
        return match ($this) {
            self::CustomDomains => 'Custom domains',
            self::AdvancedReporting => 'Advanced reporting',
            self::WhiteLabel => 'White label',
            self::LearnerPortal => 'Learner portal',
            self::Training => 'Training',
            self::Ticketing => 'Ticketing',
            self::Checklists => 'Checklists',
            self::KnowledgeBase => 'Knowledge base',
        };
    }

    /**
     * @return array<string, bool>
     */
    public static function map(bool $enabled): array
    {
        $map = [];
        foreach (self::cases() as $feature) {
            $map[$feature->value] = $enabled;
        }

        return $map;
    }
}
