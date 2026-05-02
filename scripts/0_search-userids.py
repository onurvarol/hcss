import json
import requests

from config import *

def get_profile_by_name(name):
    """
    Searches for a researcher by name and returns the top match.
    """
    params = {
        "search": name,
        "mailto": EMAIL
    }
    
    response = requests.get(BASE_URL, params=params, headers=HEADERS)
    if response.status_code == 200:
        data = response.json()
        results = data.get('results', [])
        # Returning the first result as it's the most relevant match
        return results[0] if results else None
    return None

def search_orcid(name, institute = None):
    url = "https://pub.orcid.org/v3.0/search/"
    # Try a more relaxed search for better matching
    q = f'"{name}"'
    if institute != None:
        q += f' OR (given-names:"{name}" AND affiliation-org-name:"{institute}")'
    params = {
        'q': q,
        'rows': 5
    }
    headers = {'Accept': 'application/json'}
    try:
        response = requests.get(url, params=params, headers=headers)
        if response.status_code == 200:
            data = response.json()
            results = data.get('result', [])
            if results:
                # For now, just taking the first result as a candidate
                return results[0].get('orcid-identifier', {}).get('path')
        else:
            print(f"Error searching for {name}: {response.status_code}")
    except Exception as e:
        print(f"Exception searching for {name}: {e}")
    return None


if __name__ == '__main__':

    METADATA_FILE = "../data/groups.json"

    metadata = json.loads(open(METADATA_FILE, "r").read())
    
    authorNames = set()
    for grp in metadata["groups"]:
        for author in grp["authors"]:
            authorNames.add(author["name"])

    print("{} authors to search".format(len(authorNames)))


    name2id = json.loads(open("../data/name2orcid.json", "r").read())

    # Populate ORCID data into groups data
    for i in range(len(metadata["groups"])):
        grp = metadata["groups"][i]
        for j in range(len(grp["authors"])):
            author = grp["authors"][j]
            metadata["groups"][i]["authors"][j]["orcid"] = name2id[author["name"]]

    with open("../data/groups-updated.json", "w") as fl:
        fl.write(json.dumps(metadata, indent=4))
    





