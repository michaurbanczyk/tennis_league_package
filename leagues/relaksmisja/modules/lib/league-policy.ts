import {validateSeason,numberedSeason} from './league-theme';
import {SITE_LEAGUE} from './site-league';
import {COURTS} from './courts';
export function validateSiteSeason(value:unknown){return validateSeason(value);}
export {finalsDates,validCourt} from './court-config';
