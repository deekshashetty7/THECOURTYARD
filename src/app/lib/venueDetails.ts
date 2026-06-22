export const DEFAULT_VENUE_DETAILS = {
  venueName: 'thecourtyard',
  venueAddress: 'TheCourtyard- Pickleball Court, Megina Mane, Kandettu Rd, Kadri Hills, Bikarnakatte Kaikamba, Padavu, Mangaluru, Karnataka 575005',
  venuePhone: '+91 8296505003',
  venueEmail: 'thecourtyardofficial@gmail.com',
  venueOperatingHoursText: '5:00 AM - 11:00 PM',
};

type VenueDetailsSource = Partial<typeof DEFAULT_VENUE_DETAILS> | Record<string, unknown> | null | undefined;

const pickVenueField = (sources: VenueDetailsSource[], key: keyof typeof DEFAULT_VENUE_DETAILS) => {
  for (const source of sources) {
    const value = source?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return DEFAULT_VENUE_DETAILS[key];
};

export const resolveVenueDetails = (...sources: VenueDetailsSource[]) => ({
  venueName: pickVenueField(sources, 'venueName'),
  venueAddress: pickVenueField(sources, 'venueAddress'),
  venuePhone: pickVenueField(sources, 'venuePhone'),
  venueEmail: pickVenueField(sources, 'venueEmail'),
  venueOperatingHoursText: pickVenueField(sources, 'venueOperatingHoursText'),
});

export const buildMapsEmbedSrc = (address: string) =>
  `https://www.google.com/maps?q=${encodeURIComponent(address)}&z=17&output=embed`;

export const buildMapsLink = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
