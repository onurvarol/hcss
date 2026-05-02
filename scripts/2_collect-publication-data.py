import json
import glob
import gzip
import time
import requests

from config import *


def get_all_works_by_author(author_id):
    """
    Retrieves a complete list of all works for a given OpenAlex Author ID.
    Handles pagination automatically.
    """
    all_works = []
    page = 1
    
    # Ensure ID is in the short format (e.g., 'A5023888391')
    short_id = author_id.split("/")[-1]
    
    while True:
        params = {
            "filter": f"author.id:{short_id}",
            "per_page": 200, # Maximize results per request to save credits
            "page": page,
            "mailto": EMAIL
        }
        
        response = requests.get("https://api.openalex.org/works", params=params, headers=HEADERS)
        
        if response.status_code != 200:
            print(f"Error: {response.status_code}")
            return None
            
        data = response.json()
        results = data.get('results', [])
        
        if not results:
            break
            
        all_works.extend(results)
        print(f"Collected page {page}... Total so far: {len(all_works)}")
        
        # Check if we've reached the end
        if len(results) < 200:
            break
            
        page += 1
        time.sleep(0.1) # Small delay to be polite
        
    return all_works


if __name__ == '__main__':

	alreadyCollected = set()

	try:
	    for fname in glob.glob("../data/publications/*.json.gz"):
	        alreadyCollected.add(fname.split("/")[-1].split(".")[0])
	except Exception as e:
	    print(e)
	print("{} already collected".format(len(alreadyCollected)))

	profileIDs = [fname.split("/")[-1].split(".")[0] for fname in glob.glob("../data/profiles/*.json")]
	print(len(profileIDs))

	for i ,oaid in enumerate(profileIDs):
	    if oaid in alreadyCollected:
	        continue

	    publications = get_all_works_by_author(oaid)
	    print("[{}] {}: {} works collected".format(i, oaid, len(publications)))

	    if publications == None:
	        break

	    with gzip.open("../data/publications/{}.json.gz".format(oaid), "wt") as fl:
	        fl.write(json.dumps(publications))

