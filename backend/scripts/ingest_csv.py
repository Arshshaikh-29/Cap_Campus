import itertools
import re
import shutil
import sys
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(ROOT))

from backend.api.database import Base, SessionLocal, engine
from backend.api.models import CollegeRecord

COLLEGE_CODE_ALIASES = {
    "16006": "6006",
    "14005": "4005",
}

CITY_OVERRIDES = {
    "1002": "Amravati",
    "1114": "Amravati",
    "1128": "Amravati",
    "1278": "Amravati",
    "2008": "Chhatrapati Sambhajinagar",
    "2032": "Chhatrapati Sambhajinagar",
    "2111": "Chhatrapati Sambhajinagar",
    "2112": "Chhatrapati Sambhajinagar",
    "2113": "Chhatrapati Sambhajinagar",
    "2114": "Chhatrapati Sambhajinagar",
    "2116": "Nanded",
    "2127": "Nanded",
    "2132": "Dharashiv",
    "2134": "Chhatrapati Sambhajinagar",
    "2135": "Chhatrapati Sambhajinagar",
    "2146": "Chhatrapati Sambhajinagar",
    "2250": "Chhatrapati Sambhajinagar",
    "2516": "Chhatrapati Sambhajinagar",
    "2522": "Chhatrapati Sambhajinagar",
    "2533": "Chhatrapati Sambhajinagar",
    "2757": "Dharashiv",
    "3012": "Mumbai",
    "3014": "Mumbai",
    "3025": "Mumbai",
    "3033": "Lonere",
    "3035": "Mumbai",
    "3036": "Mumbai",
    "3135": "Navi Mumbai",
    "3139": "Mumbai",
    "3146": "Navi Mumbai",
    "3147": "Navi Mumbai",
    "3148": "Mumbai",
    "3154": "Navi Mumbai",
    "3175": "Navi Mumbai",
    "3176": "Mumbai",
    "3182": "Mumbai",
    "3183": "Navi Mumbai",
    "3184": "Mumbai",
    "3185": "Mumbai",
    "3187": "Navi Mumbai",
    "3189": "Navi Mumbai",
    "3190": "Navi Mumbai",
    "3192": "Navi Mumbai",
    "3196": "Navi Mumbai",
    "3199": "Mumbai",
    "3201": "Mumbai",
    "3203": "Mumbai",
    "3204": "Mumbai",
    "3206": "Navi Mumbai",
    "3207": "Navi Mumbai",
    "3208": "Mumbai",
    "3209": "Mumbai",
    "3210": "Mumbai",
    "3211": "Navi Mumbai",
    "3212": "Navi Mumbai",
    "3214": "Mumbai",
    "3215": "Mumbai",
    "3222": "Mumbai",
    "3224": "Navi Mumbai",
    "3351": "Mumbai",
    "3353": "Navi Mumbai",
    "3423": "Mumbai",
    "3439": "Navi Mumbai",
    "3465": "Navi Mumbai",
    "3475": "Thane",
    "3503": "Navi Mumbai",
    "3546": "Navi Mumbai",
    "4004": "Chandrapur",
    "4005": "Nagpur",
    "4025": "Nagpur",
    "4115": "Nagpur",
    "4116": "Nagpur",
    "4123": "Nagpur",
    "4134": "Nagpur",
    "4135": "Nagpur",
    "4136": "Nagpur",
    "4137": "Nagpur",
    "4138": "Nagpur",
    "4139": "Nagpur",
    "4142": "Nagpur",
    "4143": "Nagpur",
    "4144": "Nagpur",
    "4145": "Nagpur",
    "4147": "Nagpur",
    "4151": "Nagpur",
    "4167": "Nagpur",
    "4172": "Nagpur",
    "4174": "Nagpur",
    "4175": "Nagpur",
    "4177": "Nagpur",
    "4181": "Nagpur",
    "4190": "Nagpur",
    "4192": "Nagpur",
    "4193": "Nagpur",
    "4195": "Nagpur",
    "4196": "Nagpur",
    "4197": "Nagpur",
    "4285": "Nagpur",
    "4304": "Nagpur",
    "4613": "Nagpur",
    "5108": "Nashik",
    "5109": "Nashik",
    "5121": "Nashik",
    "5124": "Ahilyanagar",
    "5139": "Ahilyanagar",
    "5151": "Nashik",
    "5160": "Ahilyanagar",
    "5173": "Nashik",
    "5177": "Nashik",
    "5179": "Nashik",
    "5181": "Nashik",
    "5182": "Nashik",
    "5184": "Nashik",
    "5303": "Ahilyanagar",
    "5330": "Nashik",
    "5331": "Nashik",
    "5365": "Ahilyanagar",
    "5380": "Ahilyanagar",
    "5382": "Ahilyanagar",
    "5390": "Nashik",
    "5396": "Nashik",
    "5401": "Nashik",
    "5409": "Nashik",
    "5411": "Nashik",
    "5418": "Nashik",
    "5449": "Ahilyanagar",
    "5497": "Ahilyanagar",
    "6004": "Pune",
    "6006": "Pune",
    "6122": "Pune",
    "6138": "Pune",
    "6139": "Pune",
    "6141": "Pune",
    "6144": "Pune",
    "6145": "Pune",
    "6146": "Pune",
    "6149": "Pune",
    "6155": "Pune",
    "6156": "Pune",
    "6175": "Pune",
    "6177": "Pune",
    "6178": "Pune",
    "6179": "Pune",
    "6182": "Pune",
    "6184": "Pune",
    "6185": "Lonavala",
    "6187": "Pune",
    "6203": "Pune",
    "6206": "Pune",
    "6207": "Pune",
    "6267": "Kolhapur",
    "6271": "Pune",
    "6272": "Pune",
    "6273": "Pune",
    "6274": "Pune",
    "6275": "Pune",
    "6276": "Pune",
    "6278": "Pune",
    "6281": "Pune",
    "6282": "Pune",
    "6284": "Baramati",
    "6285": "Pune",
    "6288": "Kolhapur",
    "6289": "Pune",
    "6298": "Pune",
    "6307": "Pune",
    "6310": "Pune",
    "6320": "Pune",
    "6322": "Pune",
    "6324": "Pune",
    "6325": "Pune",
    "6419": "Pune",
    "6609": "Pune",
    "6622": "Pune",
    "6625": "Pune",
    "6628": "Pune",
    "6632": "Pune",
    "6634": "Pune",
    "6635": "Pune",
    "6649": "Pune",
    "6732": "Pune",
    "6754": "Pune",
    "6755": "Pune",
    "6758": "Talegaon",
    "6759": "Pune",
    "6767": "Pune",
    "6768": "Pune",
    "6769": "Pune",
    "6770": "Lonavala",
    "6772": "Pune",
    "6780": "Baramati",
    "6787": "Pune",
    "6794": "Pune",
    "6795": "Pune",
    "6796": "Pune",
    "6802": "Pune",
    "6808": "Pune",
    "6809": "Pune",
    "6811": "Kolhapur",
    "6815": "Pune",
    "6822": "Pune",
    "6834": "Pune",
    "6839": "Pune",
    "6878": "Pune",
    "6991": "Pune",
}

KNOWN_CITIES = [
    ("Navi Mumbai", ["navi mumbai", "nerul", "kharghar", "airoli", "vashi", "panvel", "new panvel", "koparkhairane", "ulwe", "kamothe", "kalamboli", "taloja"]),
    ("Mumbai", ["mumbai", "matunga", "andheri", "bandra", "chembur", "byculla", "sion", "wadala", "vidyavihar", "borivali", "kandivali", "malad", "kurla", "mahim", "grant road", "fort", "vile parle", "santacruz"]),
    ("Thane", ["thane", "bhayander", "mira road", "dombivli"]),
    ("Pune", ["pune", "pimpri", "chinchwad", "akurdi", "nigdi", "kondhwa", "kothrud", "shivajinagar", "hadapsar", "wagholi", "narhe", "ambegaon", "lavale", "baner", "bavdhan", "warje", "pisoli", "lohegaon", "tathawade", "ravet", "vadgaon", "alandi", "chakan", "sanaswadi", "indapur", "bhor", "junnar", "mulshi", "velhe", "maval"]),
    ("Nagpur", ["nagpur", "hingna", "wanadongri", "digdoh", "koradi", "kalmeshwar", "mouda", "kamptee", "umred", "ramtek"]),
    ("Nashik", ["nashik", "nasik", "ojas", "pancavati", "satpur", "adgaon", "chandwad", "sinnar", "yeola", "niphad", "malegaon"]),
    ("Chhatrapati Sambhajinagar", ["chhatrapati sambhajinagar", "sambhajinagar", "aurangabad", "paithan", "vaijapur", "kannad"]),
    ("Ahilyanagar", ["ahilyanagar", "ahmednagar", "sangamner", "kopargaon", "pravaranagar", "loni", "rahuri", "shrirampur", "shevgaon", "shrigonda", "nevasa", "ghulewadi"]),
    ("Kolhapur", ["kolhapur", "ichalkaranji", "jaysingpur", "warananagar", "gadhinglaj", "kagal", "shirol", "panhala", "hatkanangale", "atigre", "yadrav"]),
    ("Sangli", ["sangli", "islampur", "miraj", "ashta", "vita", "kasegaon", "palus", "kavathe mahankal", "budhgaon", "sakharale"]),
    ("Solapur", ["solapur", "pandharpur", "barshi", "akluj", "malshiras", "sangola", "paniv", "karmala", "mohal"]),
    ("Satara", ["satara", "karad", "phaltan", "wai", "lonand", "koregaon", "limb", "vaduj"]),
    ("Amravati", ["amravati", "badnera", "daryapur", "achpur", "morshi"]),
    ("Jalgaon", ["jalgaon", "bhusawal", "faizpur", "chalisgaon", "chopda", "jamner", "pachora"]),
    ("Nanded", ["nanded", "vishnupuri"]),
    ("Latur", ["latur", "udgir", "ahmedpur", "nilanga"]),
    ("Akola", ["akola"]),
    ("Yavatmal", ["yavatmal", "pusad", "darwha", "wani"]),
    ("Buldhana", ["buldhana", "shegaon", "khamgaon", "chikhli", "malkapur"]),
    ("Wardha", ["wardha", "sevagram", "bapurao", "salod", "pulgaon"]),
    ("Chandrapur", ["chandrapur", "bhadravati", "ballarpur", "warora", "gadchiroli", "wadsa"]),
    ("Dhule", ["dhule", "shirpur"]),
    ("Nandurbar", ["nandurbar", "shahada", "akkalkuwa"]),
    ("Ratnagiri", ["ratnagiri", "chiplun", "khed", "deorukh", "ambav"]),
    ("Sindhudurg", ["sindhudurg", "kankavli", "sawantwadi", "malvan", "kudal", "sukalwad"]),
    ("Raigad", ["raigad", "lonere", "karjat", "khalapur", "pen", "panvel", "mahad", "alibag", "roha"]),
    ("Palghar", ["palghar", "vasai", "virar", "boisar", "kaman", "dahanu", "wada"]),
    ("Kalyan", ["kalyan", "ulhasnagar", "ambernath", "badlapur", "vangani", "titwala", "shahapur", "bhiwandi", "asangaon"]),
    ("Beed", ["beed", "ambajogai", "georai"]),
    ("Dharashiv", ["dharashiv", "osmanabad", "tuljapur", "omerga"]),
    ("Parbhani", ["parbhani"]),
    ("Jalna", ["jalna"]),
    ("Hingoli", ["hingoli"]),
    ("Washim", ["washim"]),
    ("Bhandara", ["bhandara", "sakoli"]),
    ("Gondia", ["gondia"]),
    ("Lonavala", ["lonavala", "kusgaon", "talegaon"]),
    ("Baramati", ["baramati", "malegaon bk"]),
]

DTE_COURSE_NAMES = {
    "00210": "Aeronautical Engineering",
    "08210": "Bio Technology",
    "19110": "Civil Engineering",
    "21910": "Robotics and Automation",
    "24210": "Computer Science and Engineering",
    "24510": "Computer Engineering",
    "24520": "Computer Engineering (Regional Language)",
    "24610": "Information Technology",
    "25110": "Computer Technology",
    "25210": "Cyber Security",
    "25310": "Internet of Things (IoT)",
    "25410": "Computer Science and Technology",
    "25710": "Computer Science and Design",
    "25910": "Mechanical and Mechatronics Engineering (Additive Manufacturing)",
    "26010": "Computer Science and Engineering (Cyber Security)",
    "26210": "Computer Science and Business Systems",
    "26310": "Artificial Intelligence (AI) and Data Science",
    "26510": "Industrial IoT",
    "26610": "Robotics and Artificial Intelligence",
    "26710": "Computer Science and Engineering (IoT)",
    "29310": "Electrical Engineering",
    "29710": "Electrical and Electronics Engineering",
    "35610": "Electrical Engg[Electronics and Power]",
    "37010": "Electronics and Communication Engineering",
    "37210": "Electronics and Telecommunication Engg",
    "37610": "Electronics Engineering (VLSI Design and Technology)",
    "37810": "Electronics Engineering ( VLSI Design and Technology)",
    "46110": "Biomedical Engineering",
    "46410": "Instrumentation and Control Engineering",
    "46510": "Technical Textiles",
    "46610": "Instrumentation Engineering",
    "50110": "Plastic and Polymer Engineering",
    "50310": "Food Technology",
    "50710": "Chemical Engineering",
    "51310": "Pharmaceuticals Chemistry and Technology",
    "51410": "Fibres and Textile Processing Technology",
    "52410": "Paper and Pulp Technology",
    "56610": "Computer Science",
    "56810": "Computer Science and Information Technology",
    "57010": "Fashion Technology",
    "60210": "Automobile Engineering",
    "60610": "Mechanical & Automation Engineering",
    "61210": "Mechanical Engineering",
    "61510": "Medical Electronics",
    "62410": "Mechatronics Engineering",
    "62510": "Production Engineering",
    "62610": "Manufacturing Science and Engineering",
    "62710": "Manufacturing Science and Engineering",
    "69410": "Metallurgy and Material Technology",
    "70110": "Mining Engineering",
    "72910": "Metallurgy and Material Technology",
    "84110": "Printing and Packing Technology",
    "84410": "Electronics and Computer Engineering",
    "88610": "Man Made Textile Technology",
    "89010": "Textile Chemistry",
    "89310": "Textile Technology",
    "89610": "Textile Technology",
    "90010": "Electronics and Computer Science",
    "90410": "Chemical Engineering",
    "90510": "Computer Science and Engineering",
    "90910": "Electronics & Telecommunication Engineering",
    "91110": "Computer Science and Engineering(Artificial Intelligence and Machine Learning)",
    "91210": "Computer Science and Engineering(Data Science)",
    "91310": "Computer Science and Engineering (IoT)",
    "91510": "Structural Engineering",
    "91610": "Automation and Robotics",
    "91710": "Data Science",
    "91910": "Robotics and Automation",
    "92010": "Computer Science and Design",
    "92110": "Artificial Intelligence and Machine Learning",
    "92210": "Civil and Environmental Engineering",
    "92510": "Computer Science and Engineering (Artificial Intelligence and Data Science)",
    "92610": "Electrical and Computer Engineering",
    "92710": "Computer Engineering (Software Engineering)",
    "92810": "Electronics and Communication(Advanced Communication Technology)",
    "99510": "Artificial Intelligence and Data Science",
    "99710": "Artificial Intelligence",
}

CSE_24210_COLLEGES = {
    "6005", "6007", "6028", "6036", "6214", "6217", "6222", "6223", "6250", "6265",
    "6267", "6268", "6269", "6270", "6277", "6283", "6288", "6303", "6304", "6305",
    "6308", "6311", "6315", "6317", "6545", "6640", "6643", "6644", "6756", "6757",
    "6766", "6781", "6803", "6811", "6901", "6938",
}

# Official DTE / State CET Cell Maharashtra verified course catalogs (ascending DTE course code order).
# Prevents PDF page-merge heuristics from hallucinating courses that an institute does not offer
# (e.g. SPCE 3014 has Civil/Electrical/Mechanical ONLY - never Computer Engineering;
#  ICT 3036 has 8 Chemical/Technology programs ONLY; Cummins 6276 has 5 specific branches, etc.).
VERIFIED_COLLEGE_CATALOGS: dict[str, list[tuple[str, str]]] = {
    "1002": [
        ("19110", "Civil Engineering"),
        ("24210", "Computer Science and Engineering"),
        ("24610", "Information Technology"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("46610", "Instrumentation Engineering"),
        ("61210", "Mechanical Engineering"),
    ],
    "1105": [
        ("19110", "Civil Engineering"),
        ("24210", "Computer Science and Engineering"),
        ("24610", "Information Technology"),
        ("26310", "Artificial Intelligence (AI) and Data Science"),
        ("26710", "Computer Science and Engineering (IoT)"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("61210", "Mechanical Engineering"),
    ],
    "2008": [
        ("19110", "Civil Engineering"),
        ("24210", "Computer Science and Engineering"),
        ("24610", "Information Technology"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("61210", "Mechanical Engineering"),
    ],
    "2020": [
        ("19110", "Civil Engineering"),
        ("24210", "Computer Science and Engineering"),
        ("24610", "Information Technology"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("46610", "Instrumentation Engineering"),
        ("50710", "Chemical Engineering"),
        ("60610", "Production Engineering"),
        ("61210", "Mechanical Engineering"),
        ("89610", "Textile Technology"),
    ],
    "3012": [
        ("19110", "Civil Engineering"),
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("37610", "Electronics Engineering"),
        ("61210", "Mechanical Engineering"),
        ("62610", "Production Engineering[Sandwich]"),
        ("89610", "Textile Technology"),
    ],
    "3014": [
        ("19110", "Civil Engineering"),
        ("29310", "Electrical Engineering"),
        ("61210", "Mechanical Engineering"),
    ],
    "3033": [
        ("19110", "Civil Engineering"),
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("37810", "Electronics Engineering (VLSI Design and Technology)"),
        ("50710", "Chemical Engineering"),
        ("52710", "Petrochemical Engineering"),
        ("61210", "Mechanical Engineering"),
        ("90510", "Computer Science and Engineering (Integrated 5 Years)"),
    ],
    "3035": [
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("25410", "Computer Science and Technology"),
        ("37010", "Electronics and Communication Engineering"),
        ("91710", "Data Science"),
        ("99710", "Artificial Intelligence"),
    ],
    "3036": [
        ("50710", "Chemical Engineering"),
        ("51110", "Dyestuff Technology"),
        ("51210", "Oil, Oleochemicals and Surfactants Technology"),
        ("51310", "Pharmaceuticals Chemistry and Technology"),
        ("51410", "Fibres and Textile Processing Technology"),
        ("51910", "Polymer Engineering and Technology"),
        ("53410", "Food Engineering and Technology"),
        ("72910", "Surface Coating Technology"),
    ],
    "3139": [
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("46110", "Bio Medical Engineering"),
        ("90010", "Electronics and Computer Science"),
    ],
    "3176": [
        ("19110", "Civil Engineering"),
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("25910", "Mechanical and Mechatronics Engineering (Additive Manufacturing)"),
        ("26710", "Computer Science and Engineering (IoT)"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("61210", "Mechanical Engineering"),
        ("90010", "Electronics and Computer Science"),
        ("91010", "Computer Science and Engineering (Cyber Security)"),
        ("92110", "Artificial Intelligence and Machine Learning"),
        ("99510", "Artificial Intelligence and Data Science"),
    ],
    "3184": [
        ("24210", "Computer Science and Engineering"),
        ("24510", "Computer Engineering"),
        ("61210", "Mechanical Engineering"),
        ("90010", "Electronics and Computer Science"),
    ],
    "3185": [
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("90010", "Electronics and Computer Science"),
        ("91610", "Automation and Robotics"),
        ("99510", "Artificial Intelligence and Data Science"),
    ],
    "3199": [
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("26310", "Artificial Intelligence (AI) and Data Science"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("61210", "Mechanical Engineering"),
        ("91210", "Computer Science and Engineering(Data Science)"),
        ("92010", "Computer Science and Engineering (IoT and Cyber Security Including Block Chain Technology)"),
        ("92110", "Artificial Intelligence and Machine Learning"),
    ],
    "3207": [
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("60210", "Automobile Engineering"),
        ("61210", "Mechanical Engineering"),
        ("90010", "Electronics and Computer Science"),
    ],
    "3209": [
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("99510", "Artificial Intelligence and Data Science"),
    ],
    "3215": [
        ("24210", "Computer Science and Engineering"),
        ("24510", "Computer Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
    ],
    "4304": [
        ("24510", "Computer Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("61210", "Mechanical Engineering"),
    ],
    "5004": [
        ("19110", "Civil Engineering"),
        ("24510", "Computer Engineering"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("46610", "Instrumentation Engineering"),
        ("61210", "Mechanical Engineering"),
    ],
    "5121": [
        ("19110", "Civil Engineering"),
        ("21910", "Robotics and Automation"),
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("25710", "Computer Science and Design"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("50710", "Chemical Engineering"),
        ("61210", "Mechanical Engineering"),
        ("99510", "Artificial Intelligence and Data Science"),
    ],
    "5172": [
        ("19110", "Civil Engineering"),
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("61210", "Mechanical Engineering"),
        ("91210", "Computer Science and Engineering(Data Science)"),
        ("92110", "Artificial Intelligence and Machine Learning"),
        ("99510", "Artificial Intelligence and Data Science"),
    ],
    "6005": [
        ("19110", "Civil Engineering"),
        ("24610", "Information Technology"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("61210", "Mechanical Engineering"),
    ],
    "6141": [
        ("19110", "Civil Engineering"),
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("26210", "Computer Science and Business Systems"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("61210", "Mechanical Engineering"),
        ("91610", "Automation and Robotics"),
    ],
    "6146": [
        ("19110", "Civil Engineering"),
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("50710", "Chemical Engineering"),
        ("61210", "Mechanical Engineering"),
        ("91110", "Computer Science and Engineering(Artificial Intelligence and Machine Learning)"),
        ("91210", "Computer Science and Engineering(Data Science)"),
        ("92710", "Computer Engineering (Software Engineering)"),
    ],
    "6155": [
        ("19110", "Civil Engineering"),
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("26010", "Computer Science and Engineering (Cyber Security)"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("61210", "Mechanical Engineering"),
        ("91110", "Computer Science and Engineering(Artificial Intelligence and Machine Learning)"),
        ("91210", "Computer Science and Engineering(Data Science)"),
        ("91310", "Computer Science and Engineering (Artificial Intelligence)"),
    ],
    "6175": [
        ("19110", "Civil Engineering"),
        ("24510", "Computer Engineering"),
        ("24590", "Computer Engineering (Regional Language)"),
        ("24610", "Information Technology"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("61210", "Mechanical Engineering"),
        ("91110", "Computer Science and Engineering(Artificial Intelligence and Machine Learning)"),
    ],
    "6214": [
        ("19110", "Civil Engineering"),
        ("21910", "Robotics and Automation"),
        ("24510", "Computer Engineering"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("56810", "Computer Science and Information Technology"),
        ("61210", "Mechanical Engineering"),
        ("62410", "Mechatronics Engineering"),
        ("92110", "Artificial Intelligence and Machine Learning"),
    ],
    "6222": [
        ("19110", "Civil Engineering"),
        ("24210", "Computer Science and Engineering"),
        ("26310", "Artificial Intelligence (AI) and Data Science"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("46510", "Technical Textiles"),
        ("57010", "Fashion Technology"),
        ("61210", "Mechanical Engineering"),
        ("88610", "Man Made Textile Technology"),
        ("89010", "Textile Chemistry"),
        ("89610", "Textile Technology"),
        ("91110", "Computer Science and Engineering(Artificial Intelligence and Machine Learning)"),
    ],
    "6250": [
        ("19110", "Civil Engineering"),
        ("24210", "Computer Science and Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("50710", "Chemical Engineering"),
        ("61210", "Mechanical Engineering"),
        ("91110", "Computer Science and Engineering(Artificial Intelligence and Machine Learning)"),
        ("91210", "Computer Science and Engineering(Data Science)"),
    ],
    "6267": [
        ("08210", "Bio Technology"),
        ("19110", "Civil Engineering"),
        ("24210", "Computer Science and Engineering"),
        ("26210", "Computer Science and Business Systems"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("61210", "Mechanical Engineering"),
        ("91110", "Computer Science and Engineering(Artificial Intelligence and Machine Learning)"),
        ("92210", "Civil and Environmental Engineering"),
    ],
    "6276": [
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("46410", "Instrumentation and Control Engineering"),
        ("61210", "Mechanical Engineering"),
    ],
    "6282": [
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("46610", "Instrumentation Engineering"),
        ("99510", "Artificial Intelligence and Data Science"),
    ],
    "6284": [
        ("19110", "Civil Engineering"),
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("61210", "Mechanical Engineering"),
        ("99510", "Artificial Intelligence and Data Science"),
    ],
}

VERIFIED_COLLEGE_CATALOGS_BY_YEAR: dict[tuple[str, int], list[tuple[str, str]]] = {
    ("3211", 2023): [
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("90010", "Electronics and Computer Science"),
        ("92010", "Computer Science and Engineering (IoT and Cyber Security Including Block Chain Technology)"),
        ("92110", "Artificial Intelligence and Machine Learning"),
        ("99510", "Artificial Intelligence and Data Science"),
    ],
    ("3211", 2024): [
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("90010", "Electronics and Computer Science"),
        ("92010", "Computer Science and Engineering (IoT and Cyber Security Including Block Chain Technology)"),
        ("92110", "Artificial Intelligence and Machine Learning"),
        ("99510", "Artificial Intelligence and Data Science"),
    ],
    ("3211", 2025): [
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("26310", "Artificial Intelligence (AI) and Data Science"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("90010", "Electronics and Computer Science"),
        ("92010", "Computer Science and Engineering (IoT and Cyber Security Including Block Chain Technology)"),
        ("92110", "Artificial Intelligence and Machine Learning"),
    ],
    ("6006", 2023): [
        ("19110", "Civil Engineering"),
        ("24510", "Computer Engineering"),
        ("26610", "Robotics and Artificial Intelligence"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("46410", "Instrumentation and Control Engineering"),
        ("61210", "Mechanical Engineering"),
        ("62710", "Manufacturing Science and Engineering"),
        ("69410", "Metallurgy and Material Technology"),
    ],
    ("6006", 2024): [
        ("19110", "Civil Engineering"),
        ("24510", "Computer Engineering"),
        ("26610", "Robotics and Artificial Intelligence"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("46410", "Instrumentation and Control Engineering"),
        ("61210", "Mechanical Engineering"),
        ("62710", "Manufacturing Science and Engineering"),
        ("69410", "Metallurgy and Material Technology"),
    ],
    ("6006", 2025): [
        ("19110", "Civil Engineering"),
        ("24510", "Computer Engineering"),
        ("29310", "Electrical Engineering"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("46410", "Instrumentation and Control Engineering"),
        ("61210", "Mechanical Engineering"),
        ("62710", "Manufacturing Science and Engineering"),
        ("69410", "Metallurgy and Material Technology"),
        ("92110", "Artificial Intelligence and Machine Learning"),
    ],
    ("6007", 2023): [
        ("19110", "Civil Engineering"),
        ("24210", "Computer Science and Engineering"),
        ("24610", "Information Technology"),
        ("29310", "Electrical Engineering"),
        ("37610", "Electronics Engineering"),
        ("61210", "Mechanical Engineering"),
    ],
    ("6007", 2024): [
        ("19110", "Civil Engineering"),
        ("21970", "Robotics and Automation (Un-Aided)"),
        ("24210", "Computer Science and Engineering"),
        ("24270", "Computer Science and Engineering (Un-Aided)"),
        ("24610", "Information Technology"),
        ("24670", "Information Technology (Un-Aided)"),
        ("29310", "Electrical Engineering"),
        ("37610", "Electronics Engineering"),
        ("61210", "Mechanical Engineering"),
        ("92170", "Artificial Intelligence and Machine Learning (Un-Aided)"),
    ],
    ("6007", 2025): [
        ("19110", "Civil Engineering"),
        ("21970", "Robotics and Automation (Un-Aided)"),
        ("24210", "Computer Science and Engineering"),
        ("24270", "Computer Science and Engineering (Un-Aided)"),
        ("24610", "Information Technology"),
        ("24670", "Information Technology (Un-Aided)"),
        ("29310", "Electrical Engineering"),
        ("37610", "Electronics Engineering"),
        ("61210", "Mechanical Engineering"),
        ("92170", "Artificial Intelligence and Machine Learning (Un-Aided)"),
    ],
    ("6273", 2024): [
        ("19110", "Civil Engineering"),
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("46410", "Instrumentation and Control Engineering"),
        ("61210", "Mechanical Engineering"),
        ("91110", "Computer Science and Engineering(Artificial Intelligence and Machine Learning)"),
        ("91210", "Computer Science and Engineering(Data Science)"),
        ("91310", "Computer Science and Engineering (Artificial Intelligence)"),
        ("92010", "Computer Science and Engineering (IoT and Cyber Security Including Block Chain Technology)"),
        ("92710", "Computer Engineering (Software Engineering)"),
        ("99510", "Artificial Intelligence and Data Science"),
    ],
    ("6273", 2025): [
        ("19110", "Civil Engineering"),
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("46410", "Instrumentation and Control Engineering"),
        ("61210", "Mechanical Engineering"),
        ("91110", "Computer Science and Engineering(Artificial Intelligence and Machine Learning)"),
        ("91210", "Computer Science and Engineering(Data Science)"),
        ("91310", "Computer Science and Engineering (Artificial Intelligence)"),
        ("92010", "Computer Science and Engineering (IoT and Cyber Security Including Block Chain Technology)"),
        ("92710", "Computer Engineering (Software Engineering)"),
        ("99510", "Artificial Intelligence and Data Science"),
    ],
    ("6285", 2023): [
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("37210", "Electronics and Telecommunication Engg"),
    ],
    ("6285", 2024): [
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("37210", "Electronics and Telecommunication Engg"),
    ],
    ("6285", 2025): [
        ("24510", "Computer Engineering"),
        ("24610", "Information Technology"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("99510", "Artificial Intelligence and Data Science"),
    ],
    ("6265", 2023): [
        ("19110", "Civil Engineering"),
        ("24210", "Computer Science and Engineering"),
        ("24610", "Information Technology"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("61510", "Mechanical and Automation Engineering"),
        ("92110", "Artificial Intelligence and Machine Learning"),
    ],
    ("6265", 2024): [
        ("19110", "Civil Engineering"),
        ("24210", "Computer Science and Engineering"),
        ("24610", "Information Technology"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("61510", "Mechanical and Automation Engineering"),
        ("92110", "Artificial Intelligence and Machine Learning"),
    ],
    ("6265", 2025): [
        ("19110", "Civil Engineering"),
        ("24210", "Computer Science and Engineering"),
        ("24610", "Information Technology"),
        ("37210", "Electronics and Telecommunication Engg"),
        ("60610", "Mechanical & Automation Engineering"),
        ("61210", "Mechanical Engineering"),
        ("92110", "Artificial Intelligence and Machine Learning"),
    ],
}


def extract_city(college_name: str, college_code: str = "") -> str:
    code = COLLEGE_CODE_ALIASES.get(str(college_code).strip(), str(college_code).strip())
    if code in CITY_OVERRIDES:
        return CITY_OVERRIDES[code]
    if not isinstance(college_name, str):
        return "Pune"
    lower = college_name.lower()
    for canonical, keywords in KNOWN_CITIES:
        for kw in keywords:
            if re.search(r"\b" + re.escape(kw) + r"\b", lower):
                return canonical
    region_fallback = {
        "1": "Amravati",
        "2": "Chhatrapati Sambhajinagar",
        "3": "Mumbai",
        "4": "Nagpur",
        "5": "Nashik",
        "6": "Pune",
    }
    return region_fallback.get(code[:1], "Pune")


def extract_canonical_city(code: str, all_names_for_code: list[str]) -> str:
    if code in CITY_OVERRIDES:
        return CITY_OVERRIDES[code]
    combined = " | ".join(all_names_for_code).lower()
    for canonical, keywords in KNOWN_CITIES:
        for kw in keywords:
            if re.search(r"\b" + re.escape(kw) + r"\b", combined):
                return canonical
    region_fallback = {
        "1": "Amravati",
        "2": "Chhatrapati Sambhajinagar",
        "3": "Mumbai",
        "4": "Nagpur",
        "5": "Nashik",
        "6": "Pune",
    }
    return region_fallback.get(str(code)[:1], "Pune")


def split_group_into_blocks(sub_df: pd.DataFrame) -> list[pd.DataFrame]:
    blocks = []
    current = []
    seen_s1 = set()
    for _, row in sub_df.iterrows():
        cat = str(row["category"]).strip()
        st = str(row["stage"]).strip()
        # Only Stage "I" starts a new branch table; "MH" is the Minority conversion stage
        # of the SAME branch immediately following Stage "I" and must never split a branch.
        is_s1 = st == "I"
        if current and is_s1 and (cat == "GOPENS" or cat in seen_s1):
            blocks.append(pd.DataFrame(current))
            current = []
            seen_s1 = set()
        current.append(row)
        if is_s1:
            seen_s1.add(cat)
    if current:
        blocks.append(pd.DataFrame(current))

    # Merge tiny 1-2 row university/Konkan sub-tables (e.g. DBATU 13K Konkan quota rows)
    # back into their preceding full-category branch block instead of inventing fake branches.
    if len(blocks) >= 2 and max(len(b) for b in blocks) >= 8:
        merged = []
        for b in blocks:
            cats = set(b["category"].astype(str).str.strip())
            if (
                merged
                and len(b) <= 2
                and len(merged[-1]) >= 8
                and cats <= {"GOPENS", "LOPENS", "EWS", "TFWS"}
            ):
                merged[-1] = pd.concat([merged[-1], b], ignore_index=True)
            else:
                merged.append(b)
        blocks = merged

    return blocks


def infer_missing_courses_in_interval(
    norm_code: str,
    prev_cc: str,
    anchor_cc: str,
    anchor_branch: str,
    nb: int,
    known_in_int: list[tuple[str, str]],
    block_dfs: list[pd.DataFrame],
) -> list[tuple[str, str]]:
    if nb == 1:
        return [(anchor_cc, anchor_branch)]
    if len(known_in_int) == nb:
        return known_in_int

    cs_code = "24210" if norm_code[:1] in ("1", "2", "4") or norm_code in CSE_24210_COLLEGES else "24510"
    cs_pair = (cs_code, DTE_COURSE_NAMES[cs_code])
    existing_map = {k: v for k, v in known_in_int if prev_cc < k < anchor_cc}

    standard_candidates = [
        ("19110", DTE_COURSE_NAMES["19110"]),
        ("21910", DTE_COURSE_NAMES["21910"]),
        cs_pair,
        ("24520", DTE_COURSE_NAMES["24520"]),
        ("24610", DTE_COURSE_NAMES["24610"]),
        ("25210", DTE_COURSE_NAMES["25210"]),
        ("26310", DTE_COURSE_NAMES["26310"]),
        ("29310", DTE_COURSE_NAMES["29310"]),
        ("37210", DTE_COURSE_NAMES["37210"]),
        ("37610", DTE_COURSE_NAMES["37610"]),
        ("46410", DTE_COURSE_NAMES["46410"]),
        ("46610", DTE_COURSE_NAMES["46610"]),
        ("50710", DTE_COURSE_NAMES["50710"]),
        ("60210", DTE_COURSE_NAMES["60210"]),
        ("60610", DTE_COURSE_NAMES["60610"]),
        ("61210", DTE_COURSE_NAMES["61210"]),
        ("62410", DTE_COURSE_NAMES["62410"]),
        ("62510", DTE_COURSE_NAMES["62510"]),
        ("62610", DTE_COURSE_NAMES["62610"]),
        ("72910", DTE_COURSE_NAMES["72910"]),
        ("89310", DTE_COURSE_NAMES["89310"]),
        ("91110", DTE_COURSE_NAMES["91110"]),
        ("91210", DTE_COURSE_NAMES["91210"]),
        ("91310", DTE_COURSE_NAMES["91310"]),
        ("92010", DTE_COURSE_NAMES["92010"]),
        ("92110", DTE_COURSE_NAMES["92110"]),
        ("99510", DTE_COURSE_NAMES["99510"]),
    ]

    needed = nb - 1
    b0_pct = float(pd.to_numeric(block_dfs[0]["percentile"], errors="coerce").max()) if len(block_dfs[0]) else 0.0
    b1_pct = float(pd.to_numeric(block_dfs[1]["percentile"], errors="coerce").max()) if len(block_dfs) > 1 and len(block_dfs[1]) else 0.0
    starts_with_civil = (prev_cc < "19110") and (b0_pct < b1_pct - 0.3)

    chosen = dict(existing_map)
    if len(chosen) < needed:
        priority_list = []
        if starts_with_civil and "19110" < anchor_cc:
            priority_list.append(("19110", DTE_COURSE_NAMES["19110"]))
        for cand_cc, cand_name in [
            cs_pair,
            ("24610", DTE_COURSE_NAMES["24610"]),
            ("29310", DTE_COURSE_NAMES["29310"]),
            ("37210", DTE_COURSE_NAMES["37210"]),
            ("61210", DTE_COURSE_NAMES["61210"]),
            ("19110", DTE_COURSE_NAMES["19110"]),
            ("26310", DTE_COURSE_NAMES["26310"]),
            ("91110", DTE_COURSE_NAMES["91110"]),
            ("91210", DTE_COURSE_NAMES["91210"]),
            ("99510", DTE_COURSE_NAMES["99510"]),
            ("46410", DTE_COURSE_NAMES["46410"]),
            ("50710", DTE_COURSE_NAMES["50710"]),
            ("92110", DTE_COURSE_NAMES["92110"]),
            ("62510", DTE_COURSE_NAMES["62510"]),
            ("62610", DTE_COURSE_NAMES["62610"]),
            ("37610", DTE_COURSE_NAMES["37610"]),
            ("25210", DTE_COURSE_NAMES["25210"]),
            ("62410", DTE_COURSE_NAMES["62410"]),
            ("60210", DTE_COURSE_NAMES["60210"]),
            ("24520", DTE_COURSE_NAMES["24520"]),
            ("21910", DTE_COURSE_NAMES["21910"]),
        ]:
            if prev_cc < cand_cc < anchor_cc:
                priority_list.append((cand_cc, cand_name))

        for cand_cc, cand_name in priority_list:
            if len(chosen) >= needed:
                break
            if cand_cc not in chosen:
                chosen[cand_cc] = cand_name

    if len(chosen) < needed:
        for cand_cc, cand_name in standard_candidates:
            if len(chosen) >= needed:
                break
            if prev_cc < cand_cc < anchor_cc and cand_cc not in chosen:
                chosen[cand_cc] = cand_name

    sorted_chosen = sorted(chosen.items(), key=lambda x: x[0])
    if len(sorted_chosen) > needed:
        if not starts_with_civil and any(k == "19110" for k, _ in sorted_chosen) and len(sorted_chosen) - 1 >= needed:
            sorted_chosen = [(k, v) for k, v in sorted_chosen if k != "19110"]
        sorted_chosen = sorted_chosen[-needed:]

    result = sorted_chosen + [(anchor_cc, anchor_branch)]
    extra_idx = 2
    while len(result) < nb:
        alt_cc = f"{anchor_cc[:4]}{extra_idx}"
        result.insert(len(result) - 1, (alt_cc, f"{anchor_branch} (Division {extra_idx})"))
        extra_idx += 1
    return result[:nb]


def clean_stage(stage_val: str) -> str:
    st = str(stage_val or "").strip()
    if not st or "\n" in st or "(" in st:
        return "I-Non PWD"
    return st


def block_profile(blk_df: pd.DataFrame) -> dict[str, float]:
    prof: dict[str, float] = {}
    for _, r in blk_df.iterrows():
        c = str(r.get("category", "")).strip()
        try:
            p = float(r.get("percentile"))
        except Exception:
            continue
        if pd.notna(p) and 0.0 < p <= 100.0:
            if c not in prof or p > prof[c]:
                prof[c] = p
    return prof


def profile_distance(p1: dict[str, float], p2: dict[str, float]) -> float:
    common = set(p1.keys()) & set(p2.keys())
    if common:
        total_w = 0.0
        total_d = 0.0
        for c in common:
            w = 3.0 if c in ("GOPENS", "LOPENS", "GOBCS", "TFWS", "EWS", "MI") else 1.0
            total_w += w
            total_d += w * abs(p1[c] - p2[c])
        return total_d / total_w
    if p1 and p2:
        return abs(max(p1.values()) - max(p2.values())) + 2.0
    return 50.0


def main():
    print("Initializing database...")
    Base.metadata.create_all(bind=engine)
    DATA_DIR = ROOT / "data"

    csv_files = sorted(DATA_DIR.glob("*_CAP[123]*.csv"))
    if not csv_files:
        print("No CSV files found in data/")
        return

    # Pass 1: Build cross-year canonical college names, cities, and known course catalogs
    raw_frames = []
    for path in csv_files:
        match = re.search(r"(20\d{2})_CAP([123])", path.name)
        year = int(match.group(1)) if match else 2023
        round_num = int(match.group(2)) if match else 1
        df = pd.read_csv(path, low_memory=False)
        df["_year"] = year
        df["_round"] = round_num
        df["_path"] = path.name
        df["norm_code"] = df["college_code"].astype(str).str.strip().replace(COLLEGE_CODE_ALIASES)
        df["course5"] = df["choice_code"].astype(str).str.strip().str[-5:]
        raw_frames.append(df)

    raw_frames.sort(key=lambda d: (int(d["_year"].iloc[0]), int(d["_round"].iloc[0])))
    all_df = pd.concat(raw_frames, ignore_index=True)

    canonical_name_map = {}
    canonical_city_map = {}
    known_courses_map = {}

    for nc, g in all_df.groupby("norm_code", sort=False):
        names = [str(x).strip() for x in g["college_name"].dropna().unique() if str(x).strip()]
        # Pick the most informative college name (prefer one with comma/location if available, else latest)
        names_with_comma = [n for n in names if "," in n]
        canonical_name_map[nc] = names_with_comma[-1] if names_with_comma else (names[-1] if names else f"College {nc}")
        canonical_city_map[nc] = extract_canonical_city(nc, names)

        seen_courses = {}
        for (cc, b), _ in g.groupby(["course5", "branch_name"], sort=False):
            seen_courses[str(cc).strip()] = str(b).strip()
        known_courses_map[nc] = sorted(seen_courses.items())

    db = SessionLocal()
    try:
        existing = db.query(CollegeRecord).first()
        if existing:
            print("Database already contains records. Clearing existing records...")
            db.query(CollegeRecord).delete()
            db.commit()

        total_records = 0
        disambiguated_blocks = 0
        year_college_courses: dict[tuple[str, int], list[tuple[str, str, dict[str, float]]]] = {}

        for df in raw_frames:
            year = int(df["_year"].iloc[0])
            round_num = int(df["_round"].iloc[0])
            path_name = str(df["_path"].iloc[0])
            print(f"Processing {path_name}...")

            records_to_insert = []
            for nc, col_grp in df.groupby("norm_code", sort=False):
                c_name = canonical_name_map[nc]
                c_city = canonical_city_map[nc]
                seen_list = known_courses_map.get(nc, [])
                r1_catalog = []

                verified_cat = VERIFIED_COLLEGE_CATALOGS_BY_YEAR.get(
                    (nc, year)
                ) or VERIFIED_COLLEGE_CATALOGS.get(nc)

                # Helper to emit DB rows for one mapped (block, choice_code, branch, profile)
                def _emit_block(blk_df, m_cc, m_br, prof):
                    if round_num == 1:
                        r1_catalog.append((m_cc, m_br, prof))
                    elif (nc, year) in year_college_courses and prof:
                        for idx, (c_cc, c_br, _) in enumerate(year_college_courses[(nc, year)]):
                            if c_cc == m_cc:
                                year_college_courses[(nc, year)][idx] = (c_cc, c_br, prof)
                    full_choice_code = f"{nc}{m_cc}"
                    for _, row in blk_df.iterrows():
                        merit_rank = row.get("merit_rank")
                        try:
                            merit_rank = float(merit_rank) if pd.notna(merit_rank) else None
                        except Exception:
                            merit_rank = None

                        percentile = row.get("percentile")
                        try:
                            percentile = float(percentile) if pd.notna(percentile) else None
                        except Exception:
                            percentile = None

                        if percentile is not None and (percentile <= 0.0 or percentile > 100.0):
                            continue

                        records_to_insert.append(
                            CollegeRecord(
                                college_code=nc,
                                college_name=c_name,
                                city=c_city,
                                choice_code=full_choice_code,
                                branch_name=m_br,
                                quota_level=str(row.get("quota_level", "")).strip(),
                                stage=clean_stage(row.get("stage", "")),
                                category=str(row.get("category", "")).strip(),
                                merit_rank=merit_rank,
                                percentile=percentile,
                                year=year,
                                round_number=round_num,
                            )
                        )

                # Priority 1: Use official verified DTE catalog for the entire institute
                # so page-merged blocks or page-spillover anchors NEVER invent non-existent branches.
                handled_by_catalog = False
                if verified_cat is not None:
                    flat_blks = []
                    for (_, _), anchor_grp in col_grp.groupby(["course5", "branch_name"], sort=False):
                        flat_blks.extend(split_group_into_blocks(anchor_grp))
                    flat_profs = [block_profile(b) for b in flat_blks]
                    n_total = len(flat_blks)

                    mapped_all = None
                    if round_num == 1 and n_total == len(verified_cat):
                        mapped_all = list(verified_cat)
                    elif round_num > 1 and (nc, year) in year_college_courses:
                        r1_all = year_college_courses[(nc, year)]
                        if len(r1_all) == n_total:
                            mapped_all = [(x[0], x[1]) for x in r1_all]
                        elif len(r1_all) > n_total and n_total >= 1 and len(r1_all) <= 16:
                            best_sub = None
                            best_cost = float("inf")
                            for sub in itertools.combinations(r1_all, n_total):
                                cost = sum(
                                    profile_distance(flat_profs[i], sub[i][2])
                                    for i in range(n_total)
                                )
                                if cost < best_cost:
                                    best_cost = cost
                                    best_sub = sub
                            if best_sub is not None:
                                mapped_all = [(x[0], x[1]) for x in best_sub]
                    elif n_total <= len(verified_cat):
                        mapped_all = list(verified_cat[:n_total])

                    if mapped_all is not None and len(mapped_all) == n_total:
                        handled_by_catalog = True
                        if n_total > 1:
                            disambiguated_blocks += n_total
                        for blk_df, (m_cc, m_br), prof in zip(flat_blks, mapped_all, flat_profs):
                            _emit_block(blk_df, m_cc, m_br, prof)

                if not handled_by_catalog:
                    prev_cc = "00000"
                    for (cc, raw_br), anchor_grp in col_grp.groupby(["course5", "branch_name"], sort=False):
                        anchor_branch = str(raw_br).strip()
                        blks = split_group_into_blocks(anchor_grp)
                        nb = len(blks)
                        profs = [block_profile(b) for b in blks]

                        mapped_courses = None
                        if round_num > 1 and (nc, year) in year_college_courses:
                            r1_int = [
                                item
                                for item in year_college_courses[(nc, year)]
                                if prev_cc < item[0] <= cc
                            ]
                            if len(r1_int) == nb:
                                mapped_courses = [(x[0], x[1]) for x in r1_int]
                            elif len(r1_int) > nb and nb >= 1 and len(r1_int) <= 16:
                                candidates = [x for x in r1_int if x[0] < cc]
                                if len(candidates) >= nb - 1:
                                    best_sub = None
                                    best_cost = float("inf")
                                    for sub in itertools.combinations(candidates, nb - 1):
                                        cost = sum(
                                            profile_distance(profs[i], sub[i][2])
                                            for i in range(nb - 1)
                                        )
                                        if cost < best_cost:
                                            best_cost = cost
                                            best_sub = sub
                                    if best_sub is not None:
                                        mapped_courses = [(x[0], x[1]) for x in best_sub] + [
                                            (cc, anchor_branch)
                                        ]

                        if mapped_courses is None:
                            in_int = [(k, v) for k, v in seen_list if prev_cc < k <= cc]
                            mapped_courses = infer_missing_courses_in_interval(
                                nc, prev_cc, cc, anchor_branch, nb, in_int, blks
                            )

                        if nb > 1:
                            disambiguated_blocks += nb

                        for blk_df, (m_cc, m_br), prof in zip(blks, mapped_courses, profs):
                            _emit_block(blk_df, m_cc, m_br, prof)
                        prev_cc = cc

                if round_num == 1:
                    year_college_courses[(nc, year)] = r1_catalog

            db.bulk_save_objects(records_to_insert)
            db.commit()
            total_records += len(records_to_insert)
            print(f"Inserted {len(records_to_insert)} records from {path_name}")

        print(f"Ingestion complete. Total records: {total_records} (disambiguated {disambiguated_blocks} course blocks)")

    except Exception as e:
        print(f"Error during ingestion: {e}")
        db.rollback()
        raise
    finally:
        db.close()

    # Keep secondary DB location in sync if backend/cap_compass.sqlite3 exists
    primary_db = ROOT / "cap_compass.sqlite3"
    secondary_db = ROOT / "backend" / "cap_compass.sqlite3"
    if primary_db.exists() and secondary_db.parent.exists():
        try:
            shutil.copy2(primary_db, secondary_db)
            print(f"Synced database to {secondary_db}")
        except Exception as copy_err:
            print(f"Note: could not sync secondary DB: {copy_err}")


if __name__ == "__main__":
    main()
