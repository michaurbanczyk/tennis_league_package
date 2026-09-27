// YouTube mark: Simple Icons 15.0.0 (CC0), stored locally in public/youtube.svg.
import {normalizeYoutubeUrl} from '@/lib/youtube';
export function YoutubeLink({url}:{url?:string}){
 let href='';try{href=normalizeYoutubeUrl(url);}catch{return null;}
 if(!href)return null;
 return <a className="youtube-link" href={href} target="_blank" rel="noopener noreferrer" aria-label="Oglądaj mecz w YouTube (otwiera nową kartę)" title="Oglądaj w YouTube"><img src="/youtube.svg" width={23} height={23} alt="" aria-hidden="true"/></a>;
}
