<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

class LoginController extends Controller
{
    /**
     * Redirect the user to authentication page.
     *
     * @return \Illuminate\Http\Response
     */
    public function redirectToProvider(Request $request)
    {
        return Socialite::driver($request->provider)->redirect();
    }

    /**
     * Obtain the user information from provider.
     *
     * @return \Illuminate\Http\Response
     */
    public function handleProviderCallback(Request $request)
    {
        $user = Socialite::driver($request->provider)->user();
        if ($user and isset($user->token)) {
            $user_local = User::where('email', $user->getEmail())->first();
            if (!$user_local) {
                $user_local = new User;
                $user_local->name = $user->getName();
                $user_local->email = $user->getEmail();
                $user_local->email_verified_at = time();
                $user_local->password = Hash::make(Str::random(32));
                $user_local->save();
            }
            Auth::login($user_local);
            return redirect()->route('map');
        }
    }
}
