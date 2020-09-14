<?php

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
 */

Route::get('/', ['uses' => 'MasterplanController@map', 'as' => 'map']);
Route::get('/issues', ['uses' => 'MasterplanController@issues', 'as' => 'issues']);

Route::prefix('data')->middleware('cache.headers:public;max_age=86400;immutable;etag')->group(function () {
    Route::get('layer/{id}/{type?}', ['uses' => 'MasterplanController@pushData', 'as' => 'data.layer']);
    Route::post('save', ['uses' => 'MasterplanController@saveData', 'as' => 'data.save']);
    Route::post('edit', ['uses' => 'MasterplanController@editData', 'as' => 'data.edit']);
});

Route::prefix('refresh')->group(function () {
    Route::get('osm/{force?}', ['uses' => 'MasterplanController@refreshOSMData', 'as' => 'refresh.osm']);
    Route::get('eia/{force?}', ['uses' => 'MasterplanController@refreshEIAData', 'as' => 'refresh.eia']);
    Route::get('bikeshare/{force?}', ['uses' => 'MasterplanController@refreshBikeshareData', 'as' => 'refresh.bikeshare']);
    Route::get('feed/{force?}', ['uses' => 'MasterplanController@refreshFeedData', 'as' => 'refresh.feed']);
});

Route::prefix('login')->group(function () {
    Route::get('{provider}', ['uses' => 'LoginController@redirectToProvider', 'as' => 'login']);
    Route::get('{provider}/callback', ['uses' => 'LoginController@handleProviderCallback', 'as' => 'login.callback']);
});

Route::prefix('admin')->group(function () {
    Route::get('/', ['uses' => 'MasterplanController@admin', 'as' => 'admin']);
});
