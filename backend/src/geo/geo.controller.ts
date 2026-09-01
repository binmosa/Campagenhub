import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { GeoDetectService } from './geo-detect.service';
import { City, Country, State } from 'country-state-city';

/**
 * Geo — read-only country / state / city reference data.
 *
 * Backed by the open-source `country-state-city` dataset (ISO 3166), served
 * from the backend so the multi-megabyte city database never enters the
 * frontend bundle. Registration and profile dropdowns fetch these lazily.
 */
@Controller('api/geo')
export class GeoController {
  constructor(private readonly geoDetectService: GeoDetectService) {}

  /** Visitor country by edge header or IP — drives market auto-routing.
   *  `?mock=ET` works outside production for local testing. */
  @Get('detect')
  detect(@Req() req: Request, @Query('mock') mock?: string) {
    return this.geoDetectService.detect(req, mock);
  }

  @Get('countries')
  getCountries() {
    return Country.getAllCountries().map((c) => ({
      iso2: c.isoCode,
      name: c.name,
    }));
  }

  @Get('states')
  getStates(@Query('country') country?: string) {
    if (!country) return [];
    return State.getStatesOfCountry(country).map((s) => ({
      iso2: s.isoCode,
      name: s.name,
    }));
  }

  @Get('cities')
  getCities(@Query('country') country?: string, @Query('state') state?: string) {
    if (!country) return [];
    const cities = state
      ? City.getCitiesOfState(country, state)
      : City.getCitiesOfCountry(country) || [];
    // Names only, de-duplicated (the dataset repeats names across districts).
    return [...new Set(cities.map((c) => c.name))];
  }
}
