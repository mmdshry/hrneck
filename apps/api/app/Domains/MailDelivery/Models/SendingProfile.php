<?php

namespace App\Domains\MailDelivery\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $name
 * @property string $from_name
 * @property string $from_email
 * @property string $mailer
 * @property bool $is_default
 */
class SendingProfile extends Model
{
    protected $fillable = [
        'name', 'from_name', 'from_email', 'mailer', 'is_default',
    ];

    protected function casts(): array
    {
        return ['is_default' => 'boolean'];
    }
}
