<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/*
    The language a visitor switched to is kept in the "language" cookie (set by switchLanguage() in
    main.js), so the page is rendered in it straight away. The configured language stays the default,
    kept as map.default_language.
*/
class Language
{
    public function handle(Request $request, Closure $next)
    {
        $code = $request->cookie('language');
        $default = config('map.default_language', config('map.language'));
        $valid = is_string($code) && preg_match('/^[a-z]{2,3}$/', $code) && is_file(public_path('translations/' . $code . '.js'));
        config(['map.default_language' => $default, 'map.language' => $valid ? $code : $default]);

        return $next($request);
    }
}
