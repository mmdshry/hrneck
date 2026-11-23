<?php

namespace App\Http\Middleware;

use App\Support\AppLocale;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

class SetUserLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $locale = AppLocale::DEFAULT;
        if ($user !== null) {
            $raw = $user->locale ?? null;
            $locale = AppLocale::normalize(is_string($raw) ? $raw : null);
        }

        App::setLocale($locale);

        return $next($request);
    }
}
