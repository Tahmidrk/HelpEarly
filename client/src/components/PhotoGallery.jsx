import { getMediaUrls } from '../utils/api';

export default function PhotoGallery({ photos }) {
  const urls = getMediaUrls(photos);
  if (!urls.length) return null;
  return <div className="parity-photos">{urls.map((url, index) => <a href={url} key={`${index}:${url}`} target="_blank" rel="noopener noreferrer" aria-label={`View attached photo ${index + 1}`}>
    <img src={url} alt={`Attached job photo ${index + 1}`} loading="lazy" />
  </a>)}</div>;
}
