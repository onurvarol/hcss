
import json
import requests
from bs4 import BeautifulSoup


def collect_and_parse_authors(chapterId):
    BASE_URL = "https://www.elgaronline.com/edcollchap/book/9781802207309/chapter{}.xml".format(chapterId)
    headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36'}

    response = requests.get(BASE_URL, headers=headers)
    html_doc = response.content

    soup = BeautifulSoup(html_doc, 'html.parser')

    author2orcid = dict()
    for divA in soup.find_all('div', class_="contributor-details")[:-1]:
        name = divA.find('span', {'data-testid': 'author-name'}).get_text(strip=True)
        try:
            orcid_link = divA.find('a', class_='orcid')['href']
            orcid_id = orcid_link.split('/')[-1]
            print(name, orcid_id)
            author2orcid[name] = orcid_id
        except:
            author2orcid[name] = None

    return author2orcid


if __name__ == '__main__':

    authorOrcid = dict()
    for i in range(59):
        for k,v in collect_and_parse_authors(i).items():
            authorOrcid[k] = v
    print(len(authorOrcid))

    #with open("../data/name2orcid.json", "w") as fl:
    #    fl.write(json.dumps(authorOrcid))


