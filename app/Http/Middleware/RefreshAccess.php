<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/*
    The /refresh/* routes download data from Overpass, feeds and sheets, so they are not left open
    for anyone to trigger: the cron passes ?token= matching map.refresh_token, a logged in admin
    may call them too.
*/
class RefreshAccess
{
    public function handle(Request $request, Closure $next)
    {
        $token = config('map.refresh_token');
        if (is_string($token) and $token !== '' and is_string($request->query('token')) and hash_equals($token, $request->query('token'))) {
            return $next($request);
        }
        $user = Auth::user();
        if ($user and in_array($user->email, config('map.admins', []), true)) {
            return $next($request);
        }
        abort(403);
    }
}
