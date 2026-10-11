const DEFAULT_MAP_ADDRESS = 'Dhaka, Bangladesh';

function buildMapUrl(address) {
  const query = encodeURIComponent(address?.trim() || DEFAULT_MAP_ADDRESS);
  return `https://www.google.com/maps?q=${query}&output=embed`;
}

export function addressPlaceholder() {
  return 'House 12, Road 8, Block C, Banani, Dhaka';
}

export default function AddressMap({ address, coordinates, label = 'Address preview' }) {
  if (!address?.trim()) return null;
  const mapped=coordinates?.location_confirmed && coordinates.latitude!=null && coordinates.longitude!=null;
  const query=mapped?Number(coordinates.latitude).toFixed(2)+','+Number(coordinates.longitude).toFixed(2):address;

  return (
    <div className="address-preview">
      <div className="address-preview-header">
        <span><i className="fas fa-location-dot"></i> {label}</span>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
          target="_blank"
          rel="noreferrer"
        >
          Open map
        </a>
      </div>
      <p>{address}</p><small>{mapped?'Confirmed approximate service area':'Unverified address search; owner must confirm service area'}</small>
      {mapped && <iframe
        title={`Map for ${address}`}
        src={buildMapUrl(query)}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />}
    </div>
  );
}
