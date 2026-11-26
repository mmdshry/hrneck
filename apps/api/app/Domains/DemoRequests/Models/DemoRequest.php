<?php

namespace App\Domains\DemoRequests\Models;

use Database\Factories\DemoRequestFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

/**
 * A "Request a demo" submission from the public landing page. Stored in the central database.
 *
 * @property int $id
 * @property string $name
 * @property string $work_email
 * @property string $company
 * @property string $role
 * @property string|null $message
 * @property string|null $locale
 * @property string|null $ip_address
 */
#[Fillable(['name', 'work_email', 'company', 'role', 'message', 'locale', 'ip_address'])]
class DemoRequest extends Model
{
    /** @use HasFactory<DemoRequestFactory> */
    use CentralConnection, HasFactory;
}
