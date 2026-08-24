<?php

use App\Http\Controllers\LoginController;
use App\Http\Controllers\MasterplanController;
use Illuminate\Support\Facades\Route;

Route::get('/', [MasterplanController::class, 'map'])->name('map');
Route::get('/issues', [MasterplanController::class, 'issues'])->name('issues');

Route::prefix('data')->middleware('cache.headers:public;max_age=86400;immutable;etag')->group(function () {
    Route::get('layer/{id}/{type?}', [MasterplanController::class, 'getLayer'])->name('data.layer');
    Route::post('save', [MasterplanController::class, 'saveData'])->name('data.save');
    Route::post('edit', [MasterplanController::class, 'editData'])->name('data.edit');
});

Route::prefix('refresh')->group(function () {
    Route::get('osm/{force?}', [MasterplanController::class, 'refreshOSMData'])->name('refresh.osm');
    Route::get('googlesheet/{force?}', [MasterplanController::class, 'refreshGooglesheetData'])->name('refresh.googlesheet');
    Route::get('bikeshare/{force?}', [MasterplanController::class, 'refreshBikeshareData'])->name('refresh.bikeshare');
    Route::get('feed/{force?}', [MasterplanController::class, 'refreshFeedData'])->name('refresh.feed');
});

Route::prefix('login')->group(function () {
    Route::get('{provider}', [LoginController::class, 'redirectToProvider'])->name('login');
    Route::get('{provider}/callback', [LoginController::class, 'handleProviderCallback'])->name('login.callback');
});

Route::prefix('admin')->group(function () {
    Route::get('/', [MasterplanController::class, 'admin'])->name('admin');
});
