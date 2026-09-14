<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // No trusted proxies are configured, matching the previous
        // Fideloper TrustProxies setup where $proxies was null.
        // the language cookie is written by the page's JavaScript, so it is not encrypted
        $middleware->encryptCookies(except: ['language']);
        $middleware->web(append: [\App\Http\Middleware\Language::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
