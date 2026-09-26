import {validateSeason,numberedSeason} from './league-theme';
import {SITE_LEAGUE} from './site-league';
export function validateSiteSeason(value:unknown){const season=validateSeason(value);if(SITE_LEAGUE==='smart'&&!numberedSeason.test(season))throw Error('Wybierz rok i numer sezonu: 1, 2 lub 3.');return season;}
export function finalsDates(value:unknown,validDate:(value:unknown)=>string){if(!Array.isArray(value)||value.length!==2)throw Error('Wpisz dwie daty finałów.');const dates=value.map(validDate);if(dates.some(d=>!d)||new Set(dates).size!==2)throw Error('Wpisz dwie różne daty finałów.');return dates.sort();}
export function validCourt(value:unknown,_board?:unknown){const s=String(value??'');if(!/^[1-5]$/.test(s))throw Error('Wybierz numer kortu od 1 do 5.');return s;}
