<?php

namespace Database\Seeders;

use App\Domains\Checklists\Models\ChecklistTemplate;
use App\Domains\Checklists\Models\ChecklistTemplateVersion;
use Illuminate\Database\Seeder;

class ChecklistHrTemplatesSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->definitions() as $def) {
            $template = ChecklistTemplate::query()->updateOrCreate(
                ['slug' => $def['slug']],
                [
                    'name' => $def['name'],
                    'category' => $def['category'],
                    'description' => $def['description'],
                    'status' => 'published',
                    'is_system' => true,
                    'current_version' => 1,
                ],
            );

            ChecklistTemplateVersion::query()->updateOrCreate(
                ['template_id' => $template->id, 'version' => 1],
                [
                    'schema_json' => ['items' => $def['items']],
                    'created_by' => null,
                ],
            );

            if ($template->current_version !== 1) {
                $template->current_version = 1;
                $template->save();
            }
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function definitions(): array
    {
        return [
            [
                'slug' => 'hr-employee-onboarding',
                'name' => 'Employee Onboarding',
                'category' => 'onboarding',
                'description' => 'HR checklist for first-week onboarding: paperwork, IT access, equipment, and day-one orientation.',
                'items' => [
                    $this->section('sec_docs', 'Paperwork & compliance', 1),
                    $this->item('offer_signed', 'checkbox', 'Signed offer / employment agreement filed', 2, required: true),
                    $this->item('id_verified', 'checkbox', 'Government ID verified', 3, required: true, requires: ['offer_signed']),
                    $this->item('tax_forms', 'checkbox', 'Tax / payroll forms collected', 4, required: true),
                    $this->item('policy_ack', 'checkbox', 'Employee handbook & policies acknowledged', 5, required: true),
                    $this->section('sec_it', 'IT & access', 6),
                    $this->item('email_created', 'checkbox', 'Corporate email provisioned', 7, required: true),
                    $this->item('sso_enabled', 'checkbox', 'SSO / MFA enrolled', 8, required: true, requires: ['email_created']),
                    $this->item('needs_laptop', 'single_select', 'Needs company laptop?', 9, required: true, options: ['yes', 'no']),
                    $this->item('laptop_asset_tag', 'short_text', 'Laptop asset tag / serial', 10, required: true, visibleWhen: $this->eq('needs_laptop', 'yes'), requires: ['needs_laptop']),
                    $this->item('software_list', 'long_text', 'Required software / licenses', 11),
                    $this->section('sec_day1', 'Day one', 12),
                    $this->item('manager_intro', 'checkbox', 'Manager introduction scheduled', 13, required: true),
                    $this->item('start_date', 'date', 'Official start date', 14, required: true),
                    $this->item('buddy_assigned', 'short_text', 'Onboarding buddy', 15),
                    $this->item('welcome_notes', 'rich_note', 'HR notes', 16, help: 'Internal notes only — not visible to the employee.'),
                ],
            ],
            [
                'slug' => 'hr-employee-offboarding',
                'name' => 'Employee Offboarding',
                'category' => 'offboarding',
                'description' => 'Exit checklist: access revocation, asset return, knowledge transfer, and final payroll.',
                'items' => [
                    $this->section('sec_exit', 'Exit details', 1),
                    $this->item('last_day', 'date', 'Last working day', 2, required: true),
                    $this->item('exit_reason', 'single_select', 'Exit reason', 3, required: true, options: ['resignation', 'termination', 'contract_end', 'other']),
                    $this->item('exit_reason_notes', 'long_text', 'Exit reason notes', 4, visibleWhen: $this->eq('exit_reason', 'other')),
                    $this->section('sec_access', 'Access revocation', 5),
                    $this->item('email_disabled', 'checkbox', 'Email & SSO disabled', 6, required: true),
                    $this->item('vpn_revoked', 'checkbox', 'VPN / remote access revoked', 7, required: true, requires: ['email_disabled']),
                    $this->item('saas_revoked', 'checkbox', 'SaaS apps & groups removed', 8, required: true),
                    $this->section('sec_assets', 'Assets & knowledge', 9),
                    $this->item('had_laptop', 'single_select', 'Had company laptop?', 10, required: true, options: ['yes', 'no']),
                    $this->item('laptop_returned', 'checkbox', 'Laptop returned & wiped', 11, required: true, visibleWhen: $this->eq('had_laptop', 'yes'), requires: ['had_laptop']),
                    $this->item('badge_returned', 'checkbox', 'Badge / keys returned', 12, required: true),
                    $this->item('knowledge_transfer', 'checkbox', 'Knowledge transfer completed', 13, required: true),
                    $this->item('kt_doc', 'file', 'Handover document upload', 14, visibleWhen: $this->eq('knowledge_transfer', true)),
                    $this->item('final_pay_cleared', 'checkbox', 'Final pay / expenses cleared', 15, required: true),
                    $this->item('exit_interview', 'long_text', 'Exit interview notes', 16),
                ],
            ],
            [
                'slug' => 'hr-it-access-provisioning',
                'name' => 'IT Access Provisioning',
                'category' => 'hr_ops',
                'description' => 'Provision email, VPN, SSO groups, and business applications for a role.',
                'items' => [
                    $this->section('sec_identity', 'Identity', 1),
                    $this->item('role_title', 'short_text', 'Role / job title', 2, required: true),
                    $this->item('department', 'short_text', 'Department', 3, required: true),
                    $this->item('manager_email', 'short_text', 'Manager email', 4, required: true),
                    $this->item('mailbox_ready', 'checkbox', 'Mailbox created', 5, required: true),
                    $this->item('mfa_enforced', 'checkbox', 'MFA enforced', 6, required: true, requires: ['mailbox_ready']),
                    $this->section('sec_network', 'Network & devices', 7),
                    $this->item('needs_vpn', 'single_select', 'Needs VPN?', 8, required: true, options: ['yes', 'no']),
                    $this->item('vpn_profile', 'short_text', 'VPN profile name', 9, required: true, visibleWhen: $this->eq('needs_vpn', 'yes')),
                    $this->item('security_groups', 'multi_select', 'Security groups', 10, required: true, options: ['employees', 'engineering', 'finance', 'hr', 'contractors']),
                    $this->section('sec_apps', 'Applications', 11),
                    $this->item('apps_granted', 'long_text', 'Apps granted (list)', 12, required: true),
                    $this->item('license_count', 'number', 'Paid licenses assigned', 13),
                    $this->item('access_ticket', 'link', 'IT ticket / change URL', 14),
                    $this->item('provision_notes', 'rich_note', 'Provisioning notes', 15),
                ],
            ],
            [
                'slug' => 'hr-internal-transfer',
                'name' => 'Internal Transfer / Role Change',
                'category' => 'hr_ops',
                'description' => 'Track department moves: revoke old access, grant new access, and update reporting lines.',
                'items' => [
                    $this->section('sec_move', 'Transfer details', 1),
                    $this->item('effective_date', 'date', 'Effective date', 2, required: true),
                    $this->item('from_department', 'short_text', 'From department', 3, required: true),
                    $this->item('to_department', 'short_text', 'To department', 4, required: true),
                    $this->item('new_manager', 'short_text', 'New manager', 5, required: true),
                    $this->item('new_title', 'short_text', 'New title', 6, required: true),
                    $this->section('sec_access_change', 'Access changes', 7),
                    $this->item('old_access_removed', 'checkbox', 'Previous role access removed', 8, required: true),
                    $this->item('new_access_granted', 'checkbox', 'New role access granted', 9, required: true, requires: ['old_access_removed']),
                    $this->item('needs_new_device', 'single_select', 'Needs new device?', 10, required: true, options: ['yes', 'no']),
                    $this->item('device_request', 'short_text', 'Device request ID', 11, visibleWhen: $this->eq('needs_new_device', 'yes')),
                    $this->item('hris_updated', 'checkbox', 'HRIS / directory updated', 12, required: true),
                    $this->item('announce_team', 'checkbox', 'Team announcement sent', 13),
                    $this->item('transfer_notes', 'long_text', 'Transfer notes', 14),
                ],
            ],
            [
                'slug' => 'hr-leave-return',
                'name' => 'Leave Return',
                'category' => 'hr_ops',
                'description' => 'Return-from-leave checklist: restore access, confirm equipment, and schedule re-entry.',
                'items' => [
                    $this->section('sec_leave', 'Leave summary', 1),
                    $this->item('leave_type', 'single_select', 'Leave type', 2, required: true, options: ['medical', 'parental', 'sabbatical', 'other']),
                    $this->item('return_date', 'date', 'Return date', 3, required: true),
                    $this->item('leave_type_notes', 'long_text', 'Leave notes', 4, visibleWhen: $this->eq('leave_type', 'other')),
                    $this->section('sec_restore', 'Restore readiness', 5),
                    $this->item('access_restored', 'checkbox', 'Accounts & SSO restored', 6, required: true),
                    $this->item('equipment_ok', 'single_select', 'Equipment still assigned?', 7, required: true, options: ['yes', 'needs_replacement', 'n_a']),
                    $this->item('replacement_asset', 'short_text', 'Replacement asset tag', 8, visibleWhen: $this->eq('equipment_ok', 'needs_replacement')),
                    $this->item('manager_checkin', 'checkbox', 'Manager check-in scheduled', 9, required: true, requires: ['access_restored']),
                    $this->item('compliance_refresh', 'checkbox', 'Mandatory training / policy refresh assigned', 10),
                    $this->item('return_notes', 'rich_note', 'HR return notes', 11),
                ],
            ],
        ];
    }

    /**
     * @param  list<string>|null  $options
     * @param  array{item_key: string, op: string, value: mixed}|null  $visibleWhen
     * @param  list<string>  $requires
     * @return array<string, mixed>
     */
    private function item(
        string $key,
        string $type,
        string $label,
        int $order,
        bool $required = false,
        ?array $options = null,
        ?array $visibleWhen = null,
        array $requires = [],
        ?string $help = null,
    ): array {
        $mappedOptions = [];
        if ($options !== null) {
            foreach ($options as $opt) {
                $mappedOptions[] = ['value' => $opt, 'label' => str_replace('_', ' ', ucfirst($opt))];
            }
        }

        return [
            'key' => $key,
            'type' => $type,
            'label' => $label,
            'help' => $help,
            'required' => $required,
            'order' => $order,
            'options' => $mappedOptions,
            'media' => null,
            'visible_when' => $visibleWhen,
            'requires' => $requires,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function section(string $key, string $label, int $order): array
    {
        return $this->item($key, 'section', $label, $order);
    }

    /**
     * @return array{item_key: string, op: string, value: mixed}
     */
    private function eq(string $itemKey, mixed $value): array
    {
        return [
            'item_key' => $itemKey,
            'op' => 'eq',
            'value' => $value,
        ];
    }
}
