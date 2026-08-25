import type { Metadata } from 'next';
import CityPageClient from './CityPageClient';

interface CityData {
  city: string;
  slug: string;
  region: string;
  heroImage: string;
  heroImageAlt: string;
  tagline: string;
  description: string;
  stats: { label: string; value: string }[];
  services: { icon: string; title: string; description: string }[];
  areas: string[];
  faqs: { question: string; answer: string }[];
  testimonials: { name: string; company: string; text: string; rating: number }[];
  nearbyLinks: { city: string; slug: string }[];
}

const cityData: Record<string, CityData> = {
  london: {
    city: 'London',
    slug: 'london',
    region: 'Greater London & Home Counties',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20London%20commercial%20building%20entrance%20with%20iconic%20glass%20architecture%20and%20city%20lights%20in%20the%20background%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20London%20architecture%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_london_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in London",
    tagline: "Book verified SIA-licensed security professionals across Central London, Canary Wharf, Westminster, and all Greater London boroughs. Available 24/7 for events, retail, corporate, and construction sites.",
    description: "QuickGuard provides London's most reliable security guard staffing platform. From corporate headquarters in the City of London to retail stores in Oxford Street, events in Wembley to construction sites in East London, our verified SIA-licensed guards cover every borough. We serve Westminster, Kensington & Chelsea, Camden, Hackney, Tower Hamlets, Southwark, Lambeth, and all 32 Greater London boroughs. With over 850 verified guards on our platform, businesses in London can book security professionals in minutes, with same-day deployment available for urgent requirements. All guards are SIA-licensed, background-checked, and rated by previous clients.",
    stats: [
      { label: 'Verified London Guards', value: '850+' },
      { label: 'Jobs Completed in London', value: '3,200+' },
      { label: 'London Clients', value: '480+' },
      { label: 'Avg Response Time', value: '12 min' },
    ],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings, co-working spaces, and corporate headquarters across the City, Canary Wharf, and West End.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: 'High street stores, shopping centres, and luxury boutiques from Oxford Street to Westfield.' },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'Concerts, conferences, private events, and public gatherings at ExCeL, Wembley, O2 Arena, and more.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Manned guarding, patrols, and access control for building sites across East London, Croydon, and Hounslow.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, restaurants, bars, and nightclubs in Soho, Shoreditch, Mayfair, and South Kensington.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge, patrol, and access control for apartment complexes and gated communities in Chelsea and Hampstead.' },
    ],
    areas: [
      'Westminster', 'City of London', 'Camden', 'Kensington', 'Chelsea', 'Islington',
      'Hackney', 'Tower Hamlets', 'Southwark', 'Lambeth', 'Wandsworth', 'Hammersmith',
      'Greenwich', 'Lewisham', 'Bromley', 'Croydon', 'Brent', 'Ealing', 'Hounslow',
      'Richmond', 'Kingston', 'Merton', 'Sutton', 'Barking', 'Dagenham', 'Havering',
      'Bexley', 'Enfield', 'Haringey', 'Waltham Forest', 'Redbridge', 'Newham', 'Harrow',
      'Barnet', 'Hillingdon',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in London?', answer: 'Most London bookings are matched within 15 minutes. For urgent same-day requirements, our AI matching system prioritises guards already active in your borough. Over 850 verified guards are available across all 32 London boroughs.' },
      { question: 'Are your London security guards fully SIA licensed?', answer: 'Yes. Every security guard on QuickGuard holds a valid SIA licence, and we verify credentials before they can accept jobs. Clients can view licence details on each guard\'s profile before confirming a booking.' },
      { question: 'Which London areas do you cover?', answer: 'We cover all 32 Greater London boroughs including Westminster, City of London, Camden, Kensington & Chelsea, Hackney, Tower Hamlets, Southwark, Lambeth, and extending to outer boroughs like Croydon, Bromley, Barnet, and Hillingdon.' },
      { question: 'What types of security services are available in London?', answer: 'We provide corporate office security, retail loss prevention, event stewards and crowd management, door supervisors for hospitality venues, construction site guarding, residential concierge, CCTV monitoring, and mobile patrols across London.' },
      { question: 'How much does it cost to hire a security guard in London?', answer: 'Hourly rates for London security guards typically range from £12 to £22 per hour depending on the licence type, shift timing, and venue location. Premium central London sites and night shifts may attract higher rates. You set your budget when posting a job.' },
      { question: 'Can I get same-day security coverage in London?', answer: 'Absolutely. QuickGuard\'s platform is designed for rapid deployment. Post an urgent job and our matching algorithm will broadcast it to available guards in your area immediately. Many London clients receive guard confirmations within 30 minutes for urgent bookings.' },
    ],
    testimonials: [
      { name: 'James Harrington', company: 'Harrington Events, Westminster', text: 'QuickGuard supplied 12 SIA-licensed stewards for our Westminster conference at 24 hours notice. Professional, punctual, and the platform made payment effortless. Our go-to for London event security now.', rating: 5 },
      { name: 'Sarah Okafor', company: 'Chelsea Retail Group', text: 'We have used QuickGuard guards across three Chelsea boutiques for loss prevention. The guards are always well-presented, SIA-verified, and the shift management through the dashboard saves us hours each week.', rating: 5 },
      { name: 'David Chen', company: 'Canary Wharf Property Management', text: 'Managing overnight security for a 40-floor office tower in Canary Wharf used to be a headache. QuickGuard lets us book night guards on demand with full SIA compliance tracking. Highly recommended.', rating: 5 },
    ],
    nearbyLinks: [
      { city: 'Manchester', slug: 'manchester' },
      { city: 'Birmingham', slug: 'birmingham' },
      { city: 'Leeds', slug: 'leeds' },
      { city: 'Liverpool', slug: 'liverpool' },
      { city: 'Glasgow', slug: 'glasgow' },
      { city: 'Edinburgh', slug: 'edinburgh' },
      { city: 'Bristol', slug: 'bristol' },
      { city: 'Cardiff', slug: 'cardiff' },
    ],
  },
  manchester: {
    city: 'Manchester',
    slug: 'manchester',
    region: 'Greater Manchester & North West',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20Manchester%20commercial%20building%20entrance%20with%20contemporary%20glass%20and%20steel%20architecture%20and%20soft%20ambient%20city%20lighting%20in%20the%20background%2C%20urban%20North%20England%20setting%20with%20tram%20and%20modern%20skyline%20visible%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20Manchester%20architecture%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_manchester_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in Manchester",
    tagline: "Book verified SIA-licensed security professionals across Manchester city centre, Salford, Trafford, Stockport, and all Greater Manchester boroughs. From Old Trafford events to Spinningfields offices.",
    description: "QuickGuard is Manchester's trusted platform for hiring SIA-licensed security guards. We serve businesses across Manchester city centre, Salford Quays, Trafford Park, and all ten Greater Manchester boroughs. Whether you need door supervisors for a Deansgate nightclub, corporate security for a Spinningfields office, or event stewards at Old Trafford or the Etihad Stadium, our platform matches you with verified professionals in minutes. With over 420 verified guards in the Greater Manchester area, we offer same-day deployment for urgent security needs. All guards hold current SIA licences and are independently rated by clients.",
    stats: [
      { label: 'Verified Manchester Guards', value: '420+' },
      { label: 'Jobs Completed in Manchester', value: '1,800+' },
      { label: 'Manchester Clients', value: '260+' },
      { label: 'Avg Response Time', value: '18 min' },
    ],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings, co-working spaces, and corporate headquarters in Spinningfields, Deansgate, and Manchester city centre.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: 'Manchester Arndale, Trafford Centre, high street stores, and independent retailers across Greater Manchester.' },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'Stadium events at Old Trafford and Etihad, concerts at AO Arena, and conferences at Manchester Central.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Manned guarding and patrols for major developments in Salford Quays, Ancoats, and Trafford Park.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, bars, and nightclubs across Deansgate Locks, Northern Quarter, and Printworks.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge, patrol, and access control for apartment blocks in Castlefield, Ancoats, and MediaCityUK.' },
    ],
    areas: [
      'Manchester City Centre', 'Salford', 'Salford Quays', 'Trafford', 'Trafford Park', 'Stockport',
      'Tameside', 'Oldham', 'Rochdale', 'Bury', 'Bolton', 'Wigan',
      'Spinningfields', 'Deansgate', 'Northern Quarter', 'Ancoats', 'Castlefield', 'MediaCityUK',
      'Whalley Range', 'Chorlton', 'Didsbury', 'Withington', 'Fallowfield', 'Rusholme',
      'Gorton', 'Levenshulme', 'Reddish', 'Denton', 'Hyde', 'Stretford', 'Sale', 'Altrincham',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in Manchester?', answer: 'Manchester bookings are typically matched within 20 minutes. Our platform has over 420 verified guards across Greater Manchester, with strong coverage in the city centre, Salford, Trafford, and Stockport areas. Same-day deployment is available for urgent jobs.' },
      { question: 'Are your Manchester security guards SIA licensed?', answer: 'Yes. Every guard on QuickGuard holds a current SIA licence, and we perform verification checks before guards can accept jobs. SIA licence numbers are visible on guard profiles for client peace of mind.' },
      { question: 'Which Manchester areas do you cover?', answer: 'We cover all ten Greater Manchester boroughs: Manchester, Salford, Trafford, Stockport, Tameside, Oldham, Rochdale, Bury, Bolton, and Wigan. This includes city centre, MediaCityUK, Salford Quays, Trafford Park, and all surrounding suburbs.' },
      { question: 'What security services do you offer in Manchester?', answer: 'Our Manchester services include corporate office guarding, retail loss prevention, event stewarding at stadiums and venues, door supervision for bars and clubs, construction site security, residential concierge and patrol, and mobile security patrols across Greater Manchester.' },
      { question: 'How much does a security guard cost in Manchester?', answer: 'Manchester security guard rates typically range from £11 to £18 per hour depending on the shift type, venue, and licence held. City centre and late-night shifts generally attract a premium. You set your budget when posting a job on QuickGuard.' },
      { question: 'Can I get same-day security guards in Manchester?', answer: 'Yes. QuickGuard is designed for fast deployment. Post an urgent job and our matching algorithm will immediately broadcast it to available guards in your area. Many Manchester businesses receive confirmations within 45 minutes for urgent same-day bookings.' },
    ],
    testimonials: [
      { name: 'Aisha Patel', company: 'Northern Quarter Events Ltd', text: 'We run events across Manchester every weekend and QuickGuard has become our exclusive security provider. The guards are always punctual, well-presented, and fully SIA verified. The booking process takes under five minutes.', rating: 5 },
      { name: 'Tom Bradley', company: 'Spinningfields Property Group', text: 'Managing security for multiple office buildings in Spinningfields used to require three different agencies. QuickGuard consolidated everything into one platform with better guards and lower costs.', rating: 5 },
      { name: 'Laura McDonald', company: 'Trafford Centre Retail Partners', text: 'We book loss prevention officers through QuickGuard for several Trafford Centre stores. The guard ratings and SIA verification give us confidence, and the payment system handles everything seamlessly.', rating: 4 },
    ],
    nearbyLinks: [
      { city: 'London', slug: 'london' },
      { city: 'Birmingham', slug: 'birmingham' },
      { city: 'Leeds', slug: 'leeds' },
      { city: 'Liverpool', slug: 'liverpool' },
      { city: 'Glasgow', slug: 'glasgow' },
      { city: 'Edinburgh', slug: 'edinburgh' },
      { city: 'Bristol', slug: 'bristol' },
      { city: 'Cardiff', slug: 'cardiff' },
    ],
  },
  birmingham: {
    city: 'Birmingham',
    slug: 'birmingham',
    region: 'West Midlands & Birmingham Area',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20Birmingham%20commercial%20building%20entrance%20with%20sleek%20contemporary%20architecture%20and%20soft%20ambient%20city%20lighting%20in%20the%20background%2C%20urban%20West%20Midlands%20setting%20with%20modern%20skyline%20and%20canal%20architecture%20visible%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20Birmingham%20cityscape%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_birmingham_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in Birmingham",
    tagline: "Book verified SIA-licensed security professionals across Birmingham city centre, Solihull, Coventry, Wolverhampton, and the wider West Midlands. From Bullring retail to NEC events.",
    description: "QuickGuard connects Birmingham businesses with verified SIA-licensed security guards across the entire West Midlands region. From the Bullring and Grand Central retail district to the NEC exhibition centre, corporate offices in Colmore Row to construction sites in Digbeth, our platform provides rapid access to professional security personnel. We serve Birmingham city centre, Solihull, Coventry, Wolverhampton, Dudley, Walsall, and all surrounding areas. With over 380 verified guards in the West Midlands region, QuickGuard enables businesses to book security in minutes with same-day availability for urgent requirements. Every guard is SIA-licensed, background-checked, and independently reviewed by clients.",
    stats: [
      { label: 'Verified West Midlands Guards', value: '380+' },
      { label: 'Jobs Completed in Birmingham', value: '1,500+' },
      { label: 'Birmingham Clients', value: '210+' },
      { label: 'Avg Response Time', value: '20 min' },
    ],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings, business parks, and corporate headquarters in Colmore Row, Brindleyplace, and Edgbaston.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: 'Bullring, Grand Central, Merry Hill, and high street stores across Birmingham and Solihull.' },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'NEC exhibitions, ICC conferences, Utilita Arena concerts, and stadium events across the West Midlands.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Site guarding, access control, and patrols for developments in Digbeth, Perry Barr, and Longbridge.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, bars, and nightclubs across Broad Street, Arcadian, and the Jewellery Quarter.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge and patrol services for apartment complexes in the city centre, Harborne, and Moseley.' },
    ],
    areas: [
      'Birmingham City Centre', 'Edgbaston', 'Harborne', 'Moseley', 'Kings Heath', 'Selly Oak',
      'Digbeth', 'Aston', 'Erdington', 'Perry Barr', 'Handsworth', 'Small Heath',
      'Sparkbrook', 'Balsall Heath', 'Acocks Green', 'Yardley', 'Sheldon', 'Solihull',
      'Coventry', 'Wolverhampton', 'Dudley', 'Walsall', 'West Bromwich', 'Sutton Coldfield',
      'Redditch', 'Bromsgrove', 'Kidderminster', 'Stourbridge', 'Halesowen', 'Oldbury',
      'Jewellery Quarter', 'Brindleyplace', 'Broad Street', 'Colmore Row', 'Longbridge',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in Birmingham?', answer: 'Birmingham bookings are typically matched within 25 minutes. Our West Midlands network includes over 380 verified guards covering Birmingham city centre, Solihull, Coventry, and Wolverhampton. Same-day deployment is available for urgent security requirements.' },
      { question: 'Are your Birmingham security guards fully SIA licensed?', answer: 'Yes. All QuickGuard security professionals hold a valid SIA licence appropriate to their role. We verify every licence before guards can accept jobs, and clients can review licence details directly on guard profiles before booking.' },
      { question: 'Which Birmingham and West Midlands areas do you cover?', answer: 'We cover Birmingham city centre and all surrounding districts including Edgbaston, Harborne, Moseley, Digbeth, Solihull, and extend to Coventry, Wolverhampton, Dudley, Walsall, and the wider West Midlands conurbation.' },
      { question: 'What types of security services are available in Birmingham?', answer: 'Our Birmingham services include corporate office security, retail loss prevention for Bullring and Grand Central, event stewarding at the NEC and Utilita Arena, door supervision for Broad Street venues, construction site guarding, residential concierge, and mobile patrols across the West Midlands.' },
      { question: 'How much does it cost to hire a security guard in Birmingham?', answer: 'Birmingham security guard rates typically range from £10.50 to £17 per hour depending on the specific licence, venue, and shift timing. Premium city centre and late-night positions command higher rates. You control your budget when posting a job.' },
      { question: 'Can I book same-day security guards in Birmingham?', answer: 'Yes. QuickGuard is built for rapid response. When you post an urgent job, our matching system immediately notifies available guards in your Birmingham area. Most clients receive confirmations within 50 minutes for urgent same-day requirements.' },
    ],
    testimonials: [
      { name: 'Robert Okonkwo', company: 'Bullring Retail Partners', text: 'QuickGuard has transformed how we hire security for our Bullring stores. We post a job and have verified, SIA-licensed guards confirmed within the hour. The guard rating system helps us pick the right people every time.', rating: 5 },
      { name: 'Emma Watson', company: 'NEC Event Management', text: 'We manage large exhibitions at the NEC and QuickGuard supplies everything from front-of-house stewards to overnight site security. The platform handles scheduling, check-ins, and payments in one place.', rating: 5 },
      { name: 'Kieran Murphy', company: 'Colmore Row Business Centre', text: 'Our Colmore Row office needed overnight security during a refit. QuickGuard matched us with a fantastic guard within 30 minutes. The SIA verification and client reviews gave us total confidence.', rating: 5 },
    ],
    nearbyLinks: [
      { city: 'London', slug: 'london' },
      { city: 'Manchester', slug: 'manchester' },
      { city: 'Leeds', slug: 'leeds' },
      { city: 'Liverpool', slug: 'liverpool' },
      { city: 'Glasgow', slug: 'glasgow' },
      { city: 'Edinburgh', slug: 'edinburgh' },
      { city: 'Bristol', slug: 'bristol' },
      { city: 'Cardiff', slug: 'cardiff' },
    ],
  },
  leeds: {
    city: 'Leeds',
    slug: 'leeds',
    region: 'West Yorkshire & Leeds Area',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20Leeds%20commercial%20building%20entrance%20with%20sleek%20contemporary%20Yorkshire%20architecture%20and%20soft%20ambient%20city%20lighting%20in%20the%20background%2C%20urban%20northern%20English%20setting%20with%20modern%20glass%20office%20towers%20and%20Victorian%20heritage%20buildings%20visible%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20Leeds%20cityscape%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_leeds_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in Leeds",
    tagline: "Book verified SIA-licensed security professionals across Leeds city centre, Headingley, Chapel Allerton, and West Yorkshire. From Victoria Gate retail to Elland Road events.",
    description: "QuickGuard connects Leeds businesses with verified SIA-licensed security guards across West Yorkshire. From corporate offices in the city centre and financial district to retail stores at Victoria Gate and Trinity Leeds, events at Elland Road and Headingley Stadium to construction sites in South Leeds, our platform provides rapid access to professional security personnel. We serve Leeds city centre, Headingley, Chapel Allerton, Horsforth, Roundhay, and all surrounding areas. With over 290 verified guards in the Leeds region, QuickGuard enables businesses to book security in minutes with same-day availability for urgent requirements. Every guard is SIA-licensed, background-checked, and independently reviewed by clients.",
    stats: [
      { label: 'Verified West Yorkshire Guards', value: '290+' },
      { label: 'Jobs Completed in Leeds', value: '1,100+' },
      { label: 'Leeds Clients', value: '170+' },
      { label: 'Avg Response Time', value: '22 min' },
    ],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings, financial sector premises, and corporate headquarters in Leeds city centre and the business district.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: 'Trinity Leeds, Victoria Gate, White Rose Centre, and high street stores across the city centre and suburbs.' },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'Stadium events at Elland Road and Headingley, concerts at First Direct Arena, and conferences across West Yorkshire.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Site guarding and access control for major developments in South Leeds, Holbeck, and the South Bank regeneration area.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, bars, restaurants, and nightclubs across Call Lane, Greek Street, and the Northern Quarter.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge and patrol services for apartment complexes and student accommodations in Headingley and the city centre.' },
    ],
    areas: [
      'Leeds City Centre', 'Headingley', 'Chapel Allerton', 'Roundhay', 'Horsforth', 'Kirkstall',
      'Hyde Park', 'Woodhouse', 'Burley', 'Armley', 'Wortley', 'Beeston',
      'Holbeck', 'Hunslet', 'Cross Gates', 'Garforth', 'Morley', 'Batley',
      'Dewsbury', 'Wakefield', 'Bradford', 'Shipley', 'Ilkley', 'Otley',
      'Guiseley', 'Yeadon', 'Pudsey', 'Farsley', 'Rothwell', 'Swillington',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in Leeds?', answer: 'Leeds bookings are typically matched within 25 minutes. Our West Yorkshire network includes over 290 verified guards covering Leeds city centre, Headingley, Chapel Allerton, and surrounding areas. Same-day deployment is available for urgent security needs.' },
      { question: 'Are your Leeds security guards SIA licensed?', answer: 'Yes. Every QuickGuard security professional in Leeds holds a valid SIA licence. We verify all credentials before guards can accept jobs, and licence details are visible on every guard profile for full client transparency.' },
      { question: 'Which Leeds areas do you cover?', answer: 'We cover Leeds city centre and all surrounding districts including Headingley, Chapel Allerton, Roundhay, Horsforth, Burley, Hyde Park, Holbeck, Beeston, Cross Gates, and extend to Wakefield, Bradford, and Dewsbury.' },
      { question: 'What security services are available in Leeds?', answer: 'Our Leeds services include corporate office guarding, retail security for Trinity Leeds and Victoria Gate, event stewarding at Elland Road and Headingley, door supervision for city centre venues, construction site guarding, residential concierge, and mobile patrols across West Yorkshire.' },
      { question: 'How much does it cost to hire a security guard in Leeds?', answer: 'Leeds security guard rates typically range from £10.50 to £16 per hour depending on the licence type, venue, and shift timing. City centre and late-night positions may attract a premium. You set your budget when posting a job on QuickGuard.' },
      { question: 'Can I get same-day security guards in Leeds?', answer: 'Yes. Post an urgent job and our matching system will immediately notify available guards in your Leeds area. Most clients receive confirmations within 55 minutes for same-day bookings. Our Headingley and city centre coverage is particularly strong.' },
    ],
    testimonials: [
      { name: 'Priya Shah', company: 'Trinity Leeds Retail', text: 'QuickGuard made finding SIA-licensed security for our Trinity Leeds store effortless. We posted the job Friday afternoon and had a verified guard confirmed by Monday morning. The guard rating feature is invaluable.', rating: 5 },
      { name: 'Mark Henderson', company: 'Elland Road Hospitality', text: 'We needed temporary stewards for a match day hospitality suite. QuickGuard matched us with four experienced guards within the hour. All SIA verified and professionally presented. Brilliant service.', rating: 5 },
      { name: 'Amelia Foster', company: 'Leeds City Centre Co-working', text: 'Our co-working space on Park Row needed front desk security. QuickGuard found us a perfect concierge guard with a Door Supervisor licence within 24 hours. Could not be happier with the service.', rating: 5 },
    ],
    nearbyLinks: [
      { city: 'London', slug: 'london' },
      { city: 'Manchester', slug: 'manchester' },
      { city: 'Birmingham', slug: 'birmingham' },
      { city: 'Liverpool', slug: 'liverpool' },
      { city: 'Glasgow', slug: 'glasgow' },
      { city: 'Edinburgh', slug: 'edinburgh' },
      { city: 'Bristol', slug: 'bristol' },
      { city: 'Cardiff', slug: 'cardiff' },
    ],
  },
  liverpool: {
    city: 'Liverpool',
    slug: 'liverpool',
    region: 'Merseyside & Liverpool Area',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20Liverpool%20commercial%20building%20entrance%20with%20iconic%20waterfront%20architecture%20and%20contemporary%20glass%20structures%20in%20the%20background%2C%20urban%20Merseyside%20setting%20with%20the%20historic%20docklands%20and%20modern%20city%20skyline%20visible%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20Liverpool%20cityscape%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_liverpool_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in Liverpool",
    tagline: "Book verified SIA-licensed security professionals across Liverpool city centre, Anfield, Sefton, and Merseyside. From Albert Dock events to Aintree race days.",
    description: "QuickGuard provides Liverpool's leading security guard staffing platform. From corporate offices in the business district and Liverpool ONE retail to events at Anfield Stadium and the M&S Bank Arena, our verified SIA-licensed guards cover every corner of the city and surrounding Merseyside. We serve Liverpool city centre, Anfield, Everton, Sefton, Knowsley, Wirral, and all surrounding areas. With over 260 verified guards in the Liverpool and Merseyside region, businesses can book security professionals in minutes, with same-day deployment available for urgent requirements. All guards are SIA-licensed, background-checked, and rated by previous clients.",
    stats: [
      { label: 'Verified Merseyside Guards', value: '260+' },
      { label: 'Jobs Completed in Liverpool', value: '950+' },
      { label: 'Liverpool Clients', value: '150+' },
      { label: 'Avg Response Time', value: '25 min' },
    ],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings and corporate headquarters in Liverpool city centre, the business district, and Liverpool Waters.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: 'Liverpool ONE, St Johns Shopping Centre, high street stores, and independent retailers across Merseyside.' },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'Stadium events at Anfield and Goodison Park, concerts at M&S Bank Arena, and the Aintree Race Festival.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Site guarding for major developments in the Baltic Triangle, Liverpool Waters, and Wirral Waters.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, bars, restaurants, and nightclubs across the Ropewalks, Concert Square, and Albert Dock.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge and patrol for apartment complexes in the city centre, Georgian Quarter, and waterfront developments.' },
    ],
    areas: [
      'Liverpool City Centre', 'Ropewalks', 'Georgian Quarter', 'Baltic Triangle', 'Albert Dock', 'Pier Head',
      'Anfield', 'Everton', 'Kirkdale', 'Vauxhall', 'Toxteth', 'Dingle',
      'Wavertree', 'Aigburth', 'Garston', 'Speke', 'Woolton', 'Allerton',
      'Childwall', 'West Derby', 'Croxteth', 'Fazakerley', 'Norris Green', 'Walton',
      'Bootle', 'Crosby', 'Formby', 'Southport', 'Birkenhead', 'Wallasey',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in Liverpool?', answer: 'Liverpool bookings are typically matched within 30 minutes. Our Merseyside network includes over 260 verified guards covering Liverpool city centre, Anfield, Bootle, and the Wirral. Same-day deployment is available for urgent security needs.' },
      { question: 'Are your Liverpool security guards SIA licensed?', answer: 'Yes. Every guard on QuickGuard holds a current SIA licence, and we verify all credentials before they can accept jobs. Clients can review licence details on guard profiles before confirming any booking.' },
      { question: 'Which Liverpool and Merseyside areas do you cover?', answer: 'We cover Liverpool city centre, Anfield, Everton, the Baltic Triangle, Albert Dock, and extend to Bootle, Crosby, Southport, Birkenhead, and the Wirral peninsula.' },
      { question: 'What security services are available in Liverpool?', answer: 'Our Liverpool services include corporate office guarding, retail security for Liverpool ONE, event stewarding at Anfield and M&S Bank Arena, door supervision for Concert Square venues, construction site guarding, residential concierge, and mobile patrols across Merseyside.' },
      { question: 'How much does it cost to hire a security guard in Liverpool?', answer: 'Liverpool security guard rates typically range from £10 to £15.50 per hour depending on the licence, venue type, and shift. City centre and match-day events may command higher rates. You set your budget when posting a job.' },
      { question: 'Can I get same-day security guards in Liverpool?', answer: 'Yes. QuickGuard is built for rapid response across Merseyside. Post an urgent job and our system immediately notifies available guards. Most Liverpool clients receive confirmations within the hour for same-day requirements.' },
    ],
    testimonials: [
      { name: 'Sean O\'Brien', company: 'Albert Dock Events', text: 'We organised a large waterfront festival at Albert Dock and QuickGuard supplied 20 SIA-licensed stewards overnight. The guards were professional, the platform handled scheduling perfectly, and payment was seamless.', rating: 5 },
      { name: 'Nadia Ali', company: 'Liverpool ONE Security Team', text: 'Managing loss prevention across multiple Liverpool ONE units used to be complex. QuickGuard simplified everything — we book guards, track shifts, and process payments from one dashboard. Game changer.', rating: 5 },
      { name: 'Graham Walsh', company: 'Baltic Triangle Studios', text: 'Our creative campus in the Baltic Triangle needed overnight security during an exhibition install. QuickGuard matched us with a vetted guard in under an hour. SIA badge checked and verified. Excellent.', rating: 5 },
    ],
    nearbyLinks: [
      { city: 'London', slug: 'london' },
      { city: 'Manchester', slug: 'manchester' },
      { city: 'Birmingham', slug: 'birmingham' },
      { city: 'Leeds', slug: 'leeds' },
      { city: 'Glasgow', slug: 'glasgow' },
      { city: 'Edinburgh', slug: 'edinburgh' },
      { city: 'Bristol', slug: 'bristol' },
      { city: 'Cardiff', slug: 'cardiff' },
    ],
  },
  glasgow: {
    city: 'Glasgow',
    slug: 'glasgow',
    region: 'Scotland & Glasgow Area',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20Glasgow%20commercial%20building%20entrance%20with%20striking%20contemporary%20Scottish%20architecture%20and%20soft%20ambient%20city%20lighting%20in%20the%20background%2C%20urban%20Scottish%20setting%20with%20modern%20glass%20towers%20and%20historic%20Victorian%20facades%20visible%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20Glasgow%20cityscape%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_glasgow_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in Glasgow",
    tagline: "Book verified SIA-licensed security professionals across Glasgow city centre, Merchant City, West End, and Greater Glasgow. From SEC events to Buchanan Galleries retail.",
    description: "QuickGuard provides Glasgow's most reliable security guard staffing platform. From corporate offices in the city centre and International Financial Services District to retail stores at Buchanan Galleries and Silverburn, events at the SEC and Hampden Park to construction sites in the Gorbals, our verified SIA-licensed guards cover every district. We serve Glasgow city centre, Merchant City, West End, Southside, East End, and all surrounding areas. With over 240 verified guards on our Glasgow platform, businesses can book security professionals in minutes, with same-day deployment available for urgent requirements. All guards are SIA-licensed, background-checked, and rated by previous clients.",
    stats: [
      { label: 'Verified Glasgow Guards', value: '240+' },
      { label: 'Jobs Completed in Glasgow', value: '820+' },
      { label: 'Glasgow Clients', value: '140+' },
      { label: 'Avg Response Time', value: '28 min' },
    ],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings and corporate headquarters in the IFSD, city centre, and Glasgow business district.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: 'Buchanan Galleries, Silverburn, St Enoch Centre, and high street stores across Glasgow and surrounding areas.' },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'Concerts and exhibitions at the SEC, football events at Ibrox and Celtic Park, and conferences across Greater Glasgow.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Site guarding for major developments in the Gorbals, Glasgow Harbour, and the Clyde waterfront regeneration.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, bars, and nightclubs across Ashton Lane, Sauchiehall Street, and the Merchant City.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge and patrol for apartment complexes in the West End, Merchant City, and Glasgow Harbour.' },
    ],
    areas: [
      'Glasgow City Centre', 'Merchant City', 'West End', 'Finnieston', 'Partick', 'Hillhead',
      'Southside', 'Gorbals', 'Govanhill', 'Pollokshields', 'Shawlands', 'Langside',
      'East End', 'Parkhead', 'Shettleston', 'Bridgeton', 'Dennistoun', 'Barmulloch',
      'North Glasgow', 'Maryhill', 'Possilpark', 'Summerston', 'Milton', 'Lambhill',
      'Paisley', 'East Kilbride', 'Cumbernauld', 'Motherwell', 'Hamilton', 'Coatbridge',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in Glasgow?', answer: 'Glasgow bookings are typically matched within 30 minutes. Our Greater Glasgow network includes over 240 verified guards covering the city centre, West End, Merchant City, and surrounding areas. Same-day deployment is available for urgent needs.' },
      { question: 'Are your Glasgow security guards SIA licensed?', answer: 'Yes. Every QuickGuard security professional in Scotland holds a valid SIA licence. We verify all credentials before guards can accept jobs, and licence details are visible on every guard profile for full client transparency.' },
      { question: 'Which Glasgow areas do you cover?', answer: 'We cover Glasgow city centre, Merchant City, West End, Finnieston, Southside, East End, and extend to Paisley, East Kilbride, Cumbernauld, and the wider Greater Glasgow area.' },
      { question: 'What security services are available in Glasgow?', answer: 'Our Glasgow services include corporate office guarding, retail security for Buchanan Galleries and Silverburn, event stewarding at the SEC and Hampden, door supervision for Ashton Lane and Merchant City venues, construction site guarding, residential concierge, and mobile patrols across Scotland.' },
      { question: 'How much does it cost to hire a security guard in Glasgow?', answer: 'Glasgow security guard rates typically range from £10 to £15 per hour depending on the licence type, venue, and shift. City centre and event shifts may attract a premium. You set your budget when posting a job.' },
      { question: 'Can I get same-day security guards in Glasgow?', answer: 'Yes. Post an urgent job and our system immediately notifies available guards in your Glasgow area. Most clients receive confirmations within the hour for same-day bookings. City centre and West End coverage is especially strong.' },
    ],
    testimonials: [
      { name: 'Iain MacLeod', company: 'SEC Glasgow Events', text: 'We used QuickGuard for a three-day exhibition at the SEC and the guards were exceptional. SIA verified, professional, and the real-time check-in tracking through the platform gave us complete oversight.', rating: 5 },
      { name: 'Rachel Stewart', company: 'Buchanan Galleries Retail', text: 'Loss prevention for our Buchanan Galleries unit was a constant challenge. QuickGuard provided consistently reliable SIA-licensed guards and the rotating shift system means we never have gaps.', rating: 5 },
      { name: 'Connor Hughes', company: 'Merchant City Apartments', text: 'Our residential complex in the Merchant City needed overnight concierge security. QuickGuard found us a qualified Door Supervisor within a day. Professional, courteous, and fully licenced. Highly recommended.', rating: 5 },
    ],
    nearbyLinks: [
      { city: 'London', slug: 'london' },
      { city: 'Manchester', slug: 'manchester' },
      { city: 'Birmingham', slug: 'birmingham' },
      { city: 'Leeds', slug: 'leeds' },
      { city: 'Liverpool', slug: 'liverpool' },
      { city: 'Edinburgh', slug: 'edinburgh' },
      { city: 'Bristol', slug: 'bristol' },
      { city: 'Cardiff', slug: 'cardiff' },
    ],
  },
  edinburgh: {
    city: 'Edinburgh',
    slug: 'edinburgh',
    region: 'Scotland & Edinburgh Area',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20Edinburgh%20commercial%20building%20entrance%20with%20striking%20contemporary%20Scottish%20architecture%20blending%20with%20historic%20stone%20buildings%20and%20soft%20ambient%20city%20lighting%20in%20the%20background%2C%20urban%20Scottish%20capital%20setting%20with%20modern%20office%20towers%20and%20ancient%20castle%20skyline%20visible%20in%20soft%20focus%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20Edinburgh%20cityscape%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_edinburgh_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in Edinburgh",
    tagline: "Book verified SIA-licensed security professionals across Edinburgh city centre, Leith, New Town, and the Lothians. From Festival events to St James Quarter retail.",
    description: "QuickGuard is Edinburgh's trusted platform for hiring SIA-licensed security guards. We serve businesses across Edinburgh city centre, the New Town, Leith, and all surrounding Lothian areas. Whether you need corporate security for a St Andrew Square office, retail guarding at St James Quarter, event stewards for the Festival or Murrayfield Stadium, or residential concierge in the New Town, our platform matches you with verified professionals in minutes. With over 210 verified guards in the Edinburgh and Lothians area, we offer same-day deployment for urgent security needs. All guards hold current SIA licences and are independently rated by clients.",
    stats: [
      { label: 'Verified Edinburgh Guards', value: '210+' },
      { label: 'Jobs Completed in Edinburgh', value: '720+' },
      { label: 'Edinburgh Clients', value: '130+' },
      { label: 'Avg Response Time', value: '30 min' },
    ],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings and corporate headquarters in the New Town, St Andrew Square, and the Edinburgh Park business district.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: 'St James Quarter, Princes Street, Ocean Terminal, and high street stores across Edinburgh and the Lothians.' },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'Festival events, concerts at Murrayfield Stadium, and conferences at the EICC and Assembly Rooms.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Site guarding for major developments in Leith, Granton, and the Edinburgh waterfront regeneration area.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, bars, and nightclubs across the Royal Mile, George Street, and Leith Walk.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge and patrol for apartment complexes in the New Town, Stockbridge, and waterfront developments.' },
    ],
    areas: [
      'Edinburgh City Centre', 'New Town', 'Old Town', 'Stockbridge', 'Leith', 'Portobello',
      'Morningside', 'Bruntsfield', 'Marchmont', 'Newington', 'Southside', 'Holyrood',
      'Abbeyhill', 'Pilton', 'Muirhouse', 'Granton', 'Corstorphine', 'Gorgie',
      'Dalry', 'Fountainbridge', 'Slateford', 'Colinton', 'Liberton', 'Craigmillar',
      'Musselburgh', 'Livingston', 'Dunfermline', 'Falkirk', 'Stirling', 'Perth',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in Edinburgh?', answer: 'Edinburgh bookings are typically matched within 35 minutes. Our Lothians network includes over 210 verified guards covering the city centre, New Town, Leith, and surrounding areas. Same-day deployment is available for urgent security needs.' },
      { question: 'Are your Edinburgh security guards SIA licensed?', answer: 'Yes. Every QuickGuard security professional in Edinburgh holds a valid SIA licence. We verify all credentials before guards can accept jobs, and licence details are visible on every guard profile.' },
      { question: 'Which Edinburgh areas do you cover?', answer: 'We cover Edinburgh city centre, New Town, Old Town, Leith, Stockbridge, Morningside, and extend to Livingston, Dunfermline, Stirling, and the wider Lothians and Central Scotland area.' },
      { question: 'What security services are available in Edinburgh?', answer: 'Our Edinburgh services include corporate office guarding, retail security for St James Quarter and Princes Street, event stewarding for the Festival and Murrayfield, door supervision for George Street venues, construction site guarding, residential concierge, and mobile patrols across Scotland.' },
      { question: 'How much does it cost to hire a security guard in Edinburgh?', answer: 'Edinburgh security guard rates typically range from £10 to £15 per hour depending on the licence type, venue, and shift. Festival season and city centre positions may attract a premium. You set your budget when posting a job.' },
      { question: 'Can I get same-day security guards in Edinburgh?', answer: 'Yes. Post an urgent job and our system immediately notifies available guards in your Edinburgh area. Most clients receive confirmations within the hour for same-day bookings. Our New Town and city centre coverage is especially strong.' },
    ],
    testimonials: [
      { name: 'Fiona Campbell', company: 'EICC Conference Partners', text: 'We manage corporate conferences at the EICC and QuickGuard has supplied reliable, SIA-verified security staff for every event. The booking process is seamless and the guards are always impeccably presented.', rating: 5 },
      { name: 'Douglas Reid', company: 'St James Quarter Management', text: 'Our shopping centre needed a flexible security solution for late-night openings and special events. QuickGuard provides vetted guards on demand with full licence verification. Outstanding platform.', rating: 5 },
      { name: 'Eilidh Fraser', company: 'Leith Waterfront Residences', text: 'Our waterfront apartment block in Leith needed 24/7 concierge security. QuickGuard found us a qualified Door Supervisor within two days. Professional, friendly, and fully SIA licenced. Could not ask for better.', rating: 5 },
    ],
    nearbyLinks: [
      { city: 'London', slug: 'london' },
      { city: 'Manchester', slug: 'manchester' },
      { city: 'Birmingham', slug: 'birmingham' },
      { city: 'Leeds', slug: 'leeds' },
      { city: 'Liverpool', slug: 'liverpool' },
      { city: 'Glasgow', slug: 'glasgow' },
      { city: 'Bristol', slug: 'bristol' },
      { city: 'Cardiff', slug: 'cardiff' },
    ],
  },
  bristol: {
    city: 'Bristol',
    slug: 'bristol',
    region: 'South West England & Bristol Area',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20Bristol%20commercial%20building%20entrance%20with%20striking%20contemporary%20architecture%20and%20soft%20ambient%20city%20lighting%20in%20the%20background%2C%20urban%20South%20West%20England%20setting%20with%20modern%20glass%20office%20towers%20and%20historic%20Clifton%20suspension%20bridge%20visible%20in%20soft%20focus%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20Bristol%20cityscape%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_bristol_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in Bristol",
    tagline: "Book verified SIA-licensed security professionals across Bristol city centre, Clifton, Temple Quarter, and the South West. From Cabot Circus retail to Ashton Gate events.",
    description: "QuickGuard connects Bristol businesses with verified SIA-licensed security guards across the South West. From corporate offices in the city centre and Temple Quarter to retail stores at Cabot Circus and Cribbs Causeway, events at Ashton Gate Stadium and the harbourside to construction sites in South Bristol, our platform provides rapid access to professional security personnel. We serve Bristol city centre, Clifton, Redland, Southville, and all surrounding areas including Bath. With over 230 verified guards in the Bristol region, QuickGuard enables businesses to book security in minutes with same-day availability for urgent requirements. Every guard is SIA-licensed, background-checked, and independently reviewed by clients.",
    stats: [
      { label: 'Verified Bristol Guards', value: '230+' },
      { label: 'Jobs Completed in Bristol', value: '780+' },
      { label: 'Bristol Clients', value: '135+' },
      { label: 'Avg Response Time', value: '27 min' },
    ],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings and corporate headquarters in the city centre, Temple Quarter, and Bristol business park areas.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: 'Cabot Circus, Cribbs Causeway, The Galleries, and high street stores across Bristol and Bath.' },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'Stadium events at Ashton Gate, concerts at the harbourside, and festivals across the South West.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Site guarding for major developments in Temple Quarter, South Bristol, and the Bristol Temple Meads regeneration area.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, bars, and nightclubs across the harbourside, Park Street, Whiteladies Road, and Stokes Croft.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge and patrol for apartment complexes in Clifton, Redland, and the city centre harbourside developments.' },
    ],
    areas: [
      'Bristol City Centre', 'Clifton', 'Redland', 'Cotham', 'Montpelier', 'Stokes Croft',
      'Southville', 'Bedminster', 'Totterdown', 'Windmill Hill', 'Knowle', 'Brislington',
      'Easton', 'Eastville', 'Fishponds', 'Staple Hill', 'Kingswood', 'Hanham',
      'Lawrence Hill', 'St Pauls', 'Barton Hill', 'Redcliffe', 'Temple Meads', 'Harbourside',
      'Long Ashton', 'Portishead', 'Clevedon', 'Weston-super-Mare', 'Bath', 'Keynsham',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in Bristol?', answer: 'Bristol bookings are typically matched within 30 minutes. Our South West network includes over 230 verified guards covering Bristol city centre, Clifton, Temple Quarter, and surrounding areas. Same-day deployment is available for urgent security needs.' },
      { question: 'Are your Bristol security guards SIA licensed?', answer: 'Yes. Every QuickGuard security professional in Bristol holds a valid SIA licence. We verify all credentials before guards can accept jobs, and licence details are visible on every guard profile for full client transparency.' },
      { question: 'Which Bristol and South West areas do you cover?', answer: 'We cover Bristol city centre, Clifton, Redland, Southville, Temple Quarter, and extend to Bath, Portishead, Weston-super-Mare, and the wider South West region.' },
      { question: 'What security services are available in Bristol?', answer: 'Our Bristol services include corporate office guarding, retail security for Cabot Circus and Cribbs Causeway, event stewarding at Ashton Gate and the harbourside, door supervision for Park Street and Stokes Croft venues, construction site guarding, residential concierge, and mobile patrols across the South West.' },
      { question: 'How much does it cost to hire a security guard in Bristol?', answer: 'Bristol security guard rates typically range from £10 to £15.50 per hour depending on the licence type, venue, and shift. City centre and event shifts may command a premium. You set your budget when posting a job.' },
      { question: 'Can I get same-day security guards in Bristol?', answer: 'Yes. Post an urgent job and our system immediately notifies available guards in your Bristol area. Most clients receive confirmations within the hour for same-day bookings. City centre and Clifton coverage is especially strong.' },
    ],
    testimonials: [
      { name: 'Oliver Bennett', company: 'Ashton Gate Stadium Events', text: 'QuickGuard supplied match day stewards for several Ashton Gate events and the service has been faultless. SIA verified, punctual, and the shift management through the app saves us hours every week.', rating: 5 },
      { name: 'Sophia Miller', company: 'Cabot Circus Security Partners', text: 'Managing security across multiple Cabot Circus units used to require multiple agencies. QuickGuard brought everything into one platform with better guards, lower costs, and full SIA compliance tracking.', rating: 5 },
      { name: 'James Taylor', company: 'Temple Quarter Developments', text: 'Our construction site in Temple Quarter needed overnight guarding during a critical phase. QuickGuard matched us with a qualified guard within 45 minutes. SIA badge verified on the platform. Excellent service.', rating: 5 },
    ],
    nearbyLinks: [
      { city: 'London', slug: 'london' },
      { city: 'Manchester', slug: 'manchester' },
      { city: 'Birmingham', slug: 'birmingham' },
      { city: 'Leeds', slug: 'leeds' },
      { city: 'Liverpool', slug: 'liverpool' },
      { city: 'Glasgow', slug: 'glasgow' },
      { city: 'Edinburgh', slug: 'edinburgh' },
      { city: 'Cardiff', slug: 'cardiff' },
    ],
  },
  cardiff: {
    city: 'Cardiff',
    slug: 'cardiff',
    region: 'Wales & Cardiff Area',
    heroImage: "https://readdy.ai/api/search-image?query=Professional%20security%20guard%20in%20formal%20black%20uniform%20standing%20confidently%20at%20a%20modern%20Cardiff%20commercial%20building%20entrance%20with%20striking%20contemporary%20Welsh%20architecture%20and%20soft%20ambient%20city%20lighting%20in%20the%20background%2C%20urban%20Welsh%20capital%20setting%20with%20modern%20glass%20office%20towers%20and%20historic%20castle%20skyline%20visible%20in%20soft%20focus%2C%20high-end%20corporate%20photography%20style%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20of%20image%20has%20clean%20dark%20gradient%20perfect%20for%20text%20overlay%2C%20right%20side%20features%20the%20guard%20and%20Cardiff%20cityscape%2C%20cinematic%20lighting%20with%20soft%20shadows%2C%20ultra%20clean%20premium%20composition%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20professional%20studio-quality%20lighting%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_cardiff_security_20260503&orientation=landscape",
    heroImageAlt: "SIA licensed security guard at a modern commercial building entrance in Cardiff",
    tagline: "Book verified SIA-licensed security professionals across Cardiff city centre, Bay, Cathays, and South Wales. From St David's retail to Principality Stadium events.",
    description: "QuickGuard is Cardiff's trusted platform for hiring SIA-licensed security guards across Wales. We serve businesses across Cardiff city centre, Cardiff Bay, Cathays, and all surrounding South Wales areas. Whether you need corporate security for a city centre office, retail guarding at St David's Dewi Sant, event stewards for the Principality Stadium or Cardiff City Stadium, or residential concierge in the Bay area, our platform matches you with verified professionals in minutes. With over 180 verified guards in the Cardiff and South Wales area, we offer same-day deployment for urgent security needs. All guards hold current SIA licences and are independently rated by clients.",
    stats: [
      { label: 'Verified Cardiff Guards', value: '180+' },
      { label: 'Jobs Completed in Cardiff', value: '620+' },
      { label: 'Cardiff Clients', value: '110+' },
      { label: 'Avg Response Time', value: '32 min' },
    ],
    services: [
      { icon: 'ri-building-line', title: 'Corporate Security', description: 'Office buildings and corporate headquarters in Cardiff city centre, the Bay, and the Cardiff Gate business park.' },
      { icon: 'ri-shopping-bag-line', title: 'Retail Security', description: "St David's Dewi Sant, Queens Arcade, Capitol Shopping Centre, and high street stores across Cardiff and Newport." },
      { icon: 'ri-calendar-event-line', title: 'Event Security', description: 'Stadium events at the Principality Stadium and Cardiff City Stadium, concerts, and conferences across South Wales.' },
      { icon: 'ri-hammer-line', title: 'Construction Site Security', description: 'Site guarding for major developments in Cardiff Bay, Central Square, and the Cardiff Central regeneration area.' },
      { icon: 'ri-hotel-line', title: 'Hospitality Security', description: 'Hotels, bars, and nightclubs across St Mary Street, Greyfriars Road, and Cardiff Bay.' },
      { icon: 'ri-home-gear-line', title: 'Residential Security', description: 'Concierge and patrol for apartment complexes in Cardiff Bay, Pontcanna, and the city centre.' },
    ],
    areas: [
      'Cardiff City Centre', 'Cardiff Bay', 'Cathays', 'Roath', 'Pontcanna', 'Canton',
      'Grangetown', 'Butetown', 'Splott', 'Adamsdown', 'Rumney', 'Llanrumney',
      'Pentwyn', 'Llanedeyrn', 'St Mellons', 'Tremorfa', 'Fairwater', 'Ely',
      'Caerau', 'Riverside', 'Heath', 'Birchgrove', 'Whitchurch', 'Rhiwbina',
      'Penarth', 'Barry', 'Newport', 'Caerphilly', 'Pontypridd', 'Bridgend',
    ],
    faqs: [
      { question: 'How quickly can I hire a security guard in Cardiff?', answer: 'Cardiff bookings are typically matched within 35 minutes. Our South Wales network includes over 180 verified guards covering the city centre, Cardiff Bay, Cathays, and surrounding areas. Same-day deployment is available for urgent security needs.' },
      { question: 'Are your Cardiff security guards SIA licensed?', answer: 'Yes. Every QuickGuard security professional in Wales holds a valid SIA licence. We verify all credentials before guards can accept jobs, and licence details are visible on every guard profile for full client transparency.' },
      { question: 'Which Cardiff and Wales areas do you cover?', answer: 'We cover Cardiff city centre, Cardiff Bay, Cathays, Roath, Pontcanna, and extend to Newport, Penarth, Barry, Caerphilly, and the wider South Wales region.' },
      { question: 'What security services are available in Cardiff?', answer: "Our Cardiff services include corporate office guarding, retail security for St David's and Queens Arcade, event stewarding at the Principality Stadium, door supervision for St Mary Street venues, construction site guarding, residential concierge, and mobile patrols across Wales." },
      { question: 'How much does it cost to hire a security guard in Cardiff?', answer: 'Cardiff security guard rates typically range from £9.50 to £14.50 per hour depending on the licence type, venue, and shift. City centre and stadium event shifts may attract a premium. You set your budget when posting a job.' },
      { question: 'Can I get same-day security guards in Cardiff?', answer: 'Yes. Post an urgent job and our system immediately notifies available guards in your Cardiff area. Most clients receive confirmations within the hour for same-day bookings. City centre and Cardiff Bay coverage is especially strong.' },
    ],
    testimonials: [
      { name: 'Gethin Jones', company: 'Principality Stadium Events', text: 'QuickGuard supplied match day security staff for several Principality Stadium events and the service was outstanding. All SIA verified, professionally presented, and the platform handled scheduling flawlessly.', rating: 5 },
      { name: 'Alys Evans', company: "St David's Dewi Sant Retail", text: "Managing security for our St David's unit used to involve multiple phone calls. QuickGuard changed everything — we post a job, pick a rated guard, and the platform handles the rest. Exceptional service.", rating: 5 },
      { name: 'Rhys Morgan', company: 'Cardiff Bay Apartments', text: 'Our apartment complex in Cardiff Bay needed overnight concierge security. QuickGuard found us a fully qualified Door Supervisor within 48 hours. Professional, reliable, and fully SIA licenced.', rating: 5 },
    ],
    nearbyLinks: [
      { city: 'London', slug: 'london' },
      { city: 'Manchester', slug: 'manchester' },
      { city: 'Birmingham', slug: 'birmingham' },
      { city: 'Leeds', slug: 'leeds' },
      { city: 'Liverpool', slug: 'liverpool' },
      { city: 'Glasgow', slug: 'glasgow' },
      { city: 'Edinburgh', slug: 'edinburgh' },
      { city: 'Bristol', slug: 'bristol' },
    ],
  },
};

export async function generateStaticParams() {
  return Object.keys(cityData).map((city) => ({ city }));
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const data = cityData[city.toLowerCase()];
  if (!data) {
    return {
      title: 'Security Guards UK | QuickGuard',
      description: 'Book verified SIA-licensed security guards across the UK.',
    };
  }

  return {
    title: `Hire SIA Licensed Security Guards in ${data.city} | QuickGuard`,
    description: `Book verified SIA-licensed security guards in ${data.city} and ${data.region}. Event, retail, corporate, and construction security. Instant matching, same-day deployment, no upfront fees.`,
    keywords: `security guards ${data.city.toLowerCase()}, SIA licensed ${data.city.toLowerCase()}, hire security ${data.city.toLowerCase()}, event security ${data.city.toLowerCase()}, door supervisor ${data.city.toLowerCase()}, security jobs ${data.city.toLowerCase()}`,
    alternates: {
      canonical: `https://quickguard.uk/security-guards/${data.slug}`,
    },
    openGraph: {
      title: `Hire SIA Licensed Security Guards in ${data.city} | QuickGuard`,
      description: `Book verified SIA-licensed security guards in ${data.city}. Event, retail, corporate, and construction security. Instant matching, same-day deployment.`,
      url: `https://quickguard.uk/security-guards/${data.slug}`,
      siteName: 'QuickGuard',
      type: 'website',
      locale: 'en_GB',
      images: [
        {
          url: 'https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/d77a7e7e-ca7e-482b-8c82-eb899404ecd8_compressed_Copy-of-Untitled.webp',
          width: 512,
          height: 512,
          alt: `QuickGuard - Hire SIA Licensed Security Guards in ${data.city}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Hire SIA Licensed Security Guards in ${data.city} | QuickGuard`,
      description: `Book verified SIA-licensed security guards in ${data.city}. Instant matching, same-day deployment.`,
      images: ['https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/d77a7e7e-ca7e-482b-8c82-eb899404ecd8_compressed_Copy-of-Untitled.webp'],
    },
  };
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const data = cityData[city.toLowerCase()];
  if (!data) {
    return null;
  }
  return <CityPageClient data={data} />;
}