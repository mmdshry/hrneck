<?php

declare(strict_types=1);

$cities = [];
$add = function (string $country, array $list) use (&$cities): void {
    foreach ($list as $city) {
        $cities[] = $country.'/'.$city;
    }
};

$add('Afghanistan', ['Kabul', 'Herat', 'Kandahar', 'Mazar-i-Sharif']);
$add('Albania', ['Tirana', 'Durres']);
$add('Algeria', ['Algiers', 'Oran', 'Constantine']);
$add('Argentina', ['Buenos Aires', 'Cordoba', 'Rosario', 'Mendoza', 'La Plata']);
$add('Armenia', ['Yerevan']);
$add('Australia', ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra', 'Gold Coast', 'Hobart']);
$add('Austria', ['Vienna', 'Graz', 'Linz', 'Salzburg']);
$add('Azerbaijan', ['Baku']);
$add('Bahrain', ['Manama']);
$add('Bangladesh', ['Dhaka', 'Chittagong', 'Khulna']);
$add('Belarus', ['Minsk']);
$add('Belgium', ['Brussels', 'Antwerp', 'Ghent', 'Liege']);
$add('Bolivia', ['La Paz', 'Santa Cruz', 'Cochabamba']);
$add('Bosnia and Herzegovina', ['Sarajevo', 'Banja Luka']);
$add('Brazil', ['Sao Paulo', 'Rio de Janeiro', 'Brasilia', 'Salvador', 'Fortaleza', 'Belo Horizonte', 'Manaus', 'Curitiba', 'Recife', 'Porto Alegre']);
$add('Bulgaria', ['Sofia', 'Plovdiv', 'Varna']);
$add('Cambodia', ['Phnom Penh', 'Siem Reap']);
$add('Canada', ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Ottawa', 'Edmonton', 'Winnipeg', 'Quebec City', 'Hamilton', 'Halifax']);
$add('Chile', ['Santiago', 'Valparaiso', 'Concepcion']);
$add('China', ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Chongqing', 'Tianjin', 'Wuhan', 'Hangzhou', 'Nanjing', 'Xi an', 'Suzhou', 'Hong Kong']);
$add('Colombia', ['Bogota', 'Medellin', 'Cali', 'Barranquilla', 'Cartagena']);
$add('Costa Rica', ['San Jose']);
$add('Croatia', ['Zagreb', 'Split']);
$add('Cuba', ['Havana', 'Santiago de Cuba']);
$add('Cyprus', ['Nicosia', 'Limassol']);
$add('Czechia', ['Prague', 'Brno', 'Ostrava']);
$add('Denmark', ['Copenhagen', 'Aarhus', 'Odense']);
$add('Dominican Republic', ['Santo Domingo', 'Santiago']);
$add('Ecuador', ['Quito', 'Guayaquil', 'Cuenca']);
$add('Egypt', ['Cairo', 'Alexandria', 'Giza', 'Luxor']);
$add('Estonia', ['Tallinn', 'Tartu']);
$add('Ethiopia', ['Addis Ababa']);
$add('Finland', ['Helsinki', 'Espoo', 'Tampere']);
$add('France', ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille']);
$add('Georgia', ['Tbilisi', 'Batumi']);
$add('Germany', ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Dusseldorf', 'Leipzig', 'Dortmund', 'Essen', 'Bremen', 'Dresden', 'Hanover', 'Nuremberg']);
$add('Ghana', ['Accra', 'Kumasi']);
$add('Greece', ['Athens', 'Thessaloniki', 'Patras']);
$add('Hungary', ['Budapest', 'Debrecen', 'Szeged']);
$add('Iceland', ['Reykjavik']);
$add('India', ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Bhopal']);
$add('Indonesia', ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Bekasi', 'Depok', 'Tangerang', 'Semarang', 'Makassar', 'Palembang']);
$add('Iran', ['Tehran', 'Mashhad', 'Isfahan', 'Karaj', 'Shiraz', 'Tabriz', 'Qom', 'Ahvaz', 'Kermanshah', 'Urmia', 'Rasht', 'Zahedan', 'Hamadan', 'Kerman', 'Yazd', 'Ardabil', 'Bandar Abbas', 'Zanjan', 'Sanandaj', 'Qazvin']);
$add('Iraq', ['Baghdad', 'Basra', 'Erbil', 'Mosul', 'Najaf', 'Sulaymaniyah']);
$add('Ireland', ['Dublin', 'Cork', 'Galway', 'Limerick']);
$add('Israel', ['Tel Aviv', 'Jerusalem', 'Haifa', 'Beersheba']);
$add('Italy', ['Rome', 'Milan', 'Naples', 'Turin', 'Palermo', 'Genoa', 'Bologna', 'Florence', 'Venice', 'Verona']);
$add('Japan', ['Tokyo', 'Yokohama', 'Osaka', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kobe', 'Kyoto', 'Kawasaki', 'Saitama', 'Hiroshima', 'Sendai']);
$add('Jordan', ['Amman', 'Irbid', 'Zarqa', 'Aqaba']);
$add('Kazakhstan', ['Almaty', 'Astana', 'Shymkent']);
$add('Kenya', ['Nairobi', 'Mombasa']);
$add('Kuwait', ['Kuwait City']);
$add('Kyrgyzstan', ['Bishkek']);
$add('Latvia', ['Riga']);
$add('Lebanon', ['Beirut', 'Tripoli']);
$add('Lithuania', ['Vilnius', 'Kaunas']);
$add('Luxembourg', ['Luxembourg']);
$add('Malaysia', ['Kuala Lumpur', 'George Town', 'Johor Bahru', 'Ipoh']);
$add('Mexico', ['Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'Leon', 'Merida', 'Cancun']);
$add('Morocco', ['Casablanca', 'Rabat', 'Marrakech', 'Fes', 'Tangier']);
$add('Myanmar', ['Yangon', 'Mandalay', 'Naypyidaw']);
$add('Nepal', ['Kathmandu', 'Pokhara']);
$add('Netherlands', ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven']);
$add('New Zealand', ['Auckland', 'Wellington', 'Christchurch', 'Hamilton']);
$add('Nigeria', ['Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt']);
$add('North Macedonia', ['Skopje']);
$add('Norway', ['Oslo', 'Bergen', 'Trondheim', 'Stavanger']);
$add('Oman', ['Muscat', 'Salalah']);
$add('Pakistan', ['Karachi', 'Lahore', 'Islamabad', 'Faisalabad', 'Rawalpindi', 'Multan', 'Peshawar', 'Quetta']);
$add('Palestine', ['Ramallah', 'Gaza', 'Nablus', 'Hebron']);
$add('Panama', ['Panama City']);
$add('Paraguay', ['Asuncion']);
$add('Peru', ['Lima', 'Arequipa', 'Cusco', 'Trujillo']);
$add('Philippines', ['Manila', 'Quezon City', 'Davao', 'Cebu', 'Makati']);
$add('Poland', ['Warsaw', 'Krakow', 'Lodz', 'Wroclaw', 'Poznan', 'Gdansk']);
$add('Portugal', ['Lisbon', 'Porto', 'Braga', 'Faro']);
$add('Qatar', ['Doha']);
$add('Romania', ['Bucharest', 'Cluj-Napoca', 'Timisoara', 'Iasi', 'Constanta']);
$add('Russia', ['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Kazan', 'Nizhny Novgorod', 'Chelyabinsk', 'Samara', 'Rostov-on-Don', 'Ufa']);
$add('Saudi Arabia', ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Khobar']);
$add('Serbia', ['Belgrade', 'Novi Sad']);
$add('Singapore', ['Singapore']);
$add('Slovakia', ['Bratislava', 'Kosice']);
$add('Slovenia', ['Ljubljana']);
$add('South Africa', ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth']);
$add('South Korea', ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju']);
$add('Spain', ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Malaga', 'Bilbao', 'Murcia', 'Palma', 'Las Palmas']);
$add('Sri Lanka', ['Colombo', 'Kandy']);
$add('Sweden', ['Stockholm', 'Gothenburg', 'Malmo', 'Uppsala']);
$add('Switzerland', ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne']);
$add('Syria', ['Damascus', 'Aleppo', 'Homs']);
$add('Taiwan', ['Taipei', 'Kaohsiung', 'Taichung', 'Tainan']);
$add('Tajikistan', ['Dushanbe']);
$add('Thailand', ['Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya', 'Nonthaburi']);
$add('Tunisia', ['Tunis', 'Sfax', 'Sousse']);
$add('Turkey', ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Gaziantep', 'Konya', 'Kayseri', 'Mersin']);
$add('Turkmenistan', ['Ashgabat']);
$add('Ukraine', ['Kyiv', 'Kharkiv', 'Odessa', 'Dnipro', 'Lviv']);
$add('United Arab Emirates', ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah']);
$add('United Kingdom', ['London', 'Birmingham', 'Manchester', 'Glasgow', 'Liverpool', 'Leeds', 'Edinburgh', 'Bristol', 'Sheffield', 'Cardiff', 'Belfast', 'Newcastle']);
$add('United States', ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'San Francisco', 'Seattle', 'Denver', 'Washington', 'Boston', 'Nashville', 'Detroit', 'Portland', 'Las Vegas', 'Miami', 'Atlanta', 'Minneapolis', 'Tampa', 'Orlando', 'Charlotte', 'Raleigh', 'Salt Lake City']);
$add('Uruguay', ['Montevideo']);
$add('Uzbekistan', ['Tashkent', 'Samarkand']);
$add('Venezuela', ['Caracas', 'Maracaibo', 'Valencia']);
$add('Vietnam', ['Hanoi', 'Ho Chi Minh City', 'Da Nang', 'Hai Phong']);
$add('Yemen', ['Sanaa', 'Aden']);

$cities = array_values(array_unique($cities));
sort($cities);

$json = json_encode($cities, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n";

$apiDir = dirname(__DIR__).'/resources/data';
$webDir = dirname(__DIR__, 2).'/web/src/lib/locations';

if (! is_dir($apiDir)) {
    mkdir($apiDir, 0777, true);
}
if (! is_dir($webDir)) {
    mkdir($webDir, 0777, true);
}

file_put_contents($apiDir.'/major-cities.json', $json);
file_put_contents($webDir.'/major-cities.json', $json);

echo count($cities)." cities written\n";
