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

Route::prefix('data')->middleware('cache.headers:public;max_age=86400;immutable;etag')->group(function () {
    Route::get('layer/{id}/{type?}', ['uses' => 'MasterplanController@pushData', 'as' => 'data.layer']);
    Route::post('save', ['uses' => 'MasterplanController@saveData', 'as' => 'data.save']);
});

Route::prefix('refresh')->group(function () {
    Route::get('osm/{force?}', ['uses' => 'MasterplanController@refreshOSMData', 'as' => 'refresh.osm']);
    Route::get('eia/{force?}', ['uses' => 'MasterplanController@refreshEIAData', 'as' => 'refresh.eia']);
    Route::get('bikeshare/{force?}', ['uses' => 'MasterplanController@refreshBikeshareData', 'as' => 'refresh.bikeshare']);
    Route::get('feed/{force?}', ['uses' => 'MasterplanController@refreshFeedData', 'as' => 'refresh.feed']);
});
