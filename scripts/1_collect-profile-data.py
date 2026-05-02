
import json
import requests

from config import *

def get_profile_by_oa(oaid):
    response = requests.get("{}/{}".format(BASE_URL, oaid.upper()), headers=HEADERS)
    if response.status_code == 200:
        data = response.json()
        return data
    return None

def get_profile_by_orcid(orcid):
    """
    Fetches a single profile using a specific ORCID.
    Accepts format: '0000-0002-1825-0097'
    """
    # Clean the ID to ensure it's the full URI OpenAlex prefers
    clean_orcid = orcid.split("/")[-1] # extract ID if full URL was passed
    full_orcid_uri = f"https://orcid.org/{clean_orcid}"
    
    params = {
        "filter": f"orcid:{full_orcid_uri}",
        "mailto": EMAIL
    }
    
    response = requests.get(BASE_URL, params=params, headers=HEADERS)
    if response.status_code == 200:
        data = response.json()
        results = data.get('results', [])
        return results[0] if results else None
    return None


if __name__ == '__main__':

    METADATA_FILE = "../data/groups-updated.json"

    metadata = json.loads(open(METADATA_FILE, "r").read())
    #print(metadata)

    orcid2name = dict()
    for grp in metadata["groups"]:
        for author in grp["authors"]:
            orcid2name[author["orcid"]] = author["name"]
    print("{} unique authors orcid".format(len(orcid2name)))

    #"""
    for i, (orcid, name) in enumerate(orcid2name.items()):
        if orcid == None:
            continue

        profile = get_profile_by_orcid(orcid)
        if profile == None:
            print("Skipped \"{}\", \"{}\"".format(orcid, name))
            continue
        profile["raw_name"] = name
        
        oaid = profile["id"].split("/")[-1].lower()
        print("[{}: {}] - {}".format(i, orcid, name))

        with open("../data/profiles/{}.json".format(oaid), "w") as fl:
            json.dump(profile, fl, indent=4)
    #"""

    #"""
    manualFix = [
        ("0009-0002-0726-1580", "Margot Gerondeau", "a5122647261"),
        ("0009-0002-2601-3961", "Jan Globisz", "a5122557104"),
        ("0000-0002-4449-0756", "P. M. Aronow", "a5029291566"),
        ("0000-0002-2792-6298", "Caleb Ziems", "a5002621773"),
        ("0009-0006-1566-4581", "Isabela Villamil", "a5072213076"),
        ("0000-0001-5839-9593", "Hana Chalmers", "a5122527774"),
        ("0000-0001-8184-5221", "Robin A. Lange", "a5122427156"),
        ("0000-0002-4030-6341", "Alex Madaras", "a5122448960"),
        ("0009-0002-9979-4877", "Courtney Allen", "a5102824047"),
        ("0000-0003-0795-7246", "Ihsan Kahveci", "a5095383854"),
        ("0000-0002-1067-7643", "Callie Graham", "a5122481225"),
        ("0000-0002-3062-7635", "Raffaele Cristodaro", "a5033472764")
    ]

    for odata in manualFix:
        profile = get_profile_by_oa(odata[2])
        profile["raw_name"] = odata[1]
        profile["orcid"] = odata[0]
        print(odata)
        with open("../data/profiles/{}.json".format(odata[2]), "w") as fl:
            json.dump(profile, fl, indent=4)
    #"""

    