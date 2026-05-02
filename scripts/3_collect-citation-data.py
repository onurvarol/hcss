import json
import glob
import gzip
import time
import requests

from config import *


def get_all_citing_publications(publication_id):
    base_url = "https://api.openalex.org/works"
    citing_works = []
    
    # We use a cursor '*' to start deep pagination
    cursor = '*'
    
    # Filter by the 'cites' attribute
    params = {
        'filter': f'cites:{publication_id}',
        'per_page': 200,
        'mailto': EMAIL,
        'cursor': cursor
    }

    while cursor:
        response = requests.get(base_url, params=params)
        
        if response.status_code != 200:
            print(f"Error: {response.status_code} - {response.reason}")
            return None
            
        data = response.json()
        results = data.get('results', [])
        
        if not results:
            break
            
        citing_works.extend(results)
        
        # Update the cursor for the next page
        cursor = data.get('meta', {}).get('next_cursor')
        params['cursor'] = cursor
        
        #print(f"Retrieved {len(citing_works)} papers...")

    return citing_works


if __name__ == '__main__':

	toCollect = set()
	try:
	    for fname in glob.glob("../data/publications/*.json.gz"):
	        publications = json.loads(gzip.open(fname, "rt").read())
	        toCollect |= {pub["id"].split("/")[-1] for pub in publications}
	except Exception as e:
	    print(e)
	print("{} publication data to collect".format(len(toCollect)))

	alreadyCollected = set()
	for fname in glob.glob("../data/citations/*.json"):
	    alreadyCollected.add(fname.split("/")[-1].split(".")[0])
	print("{} publication already collected".format(len(alreadyCollected)))

	toCollect = toCollect - alreadyCollected
	print("{} publication will be collected".format(len(toCollect)))

	for i,pub in enumerate(toCollect):
	    citing_papers = get_all_citing_publications(pub)
	    if citing_papers == None:
	        time.sleep(5)
	        continue
	    print("[{}/{}] {}: {} citations".format(i, len(toCollect), pub, len(citing_papers)))
	    with open("../data/citations/{}.json".format(pub), "w") as fl:
	        json.dump(citing_papers, fl)
