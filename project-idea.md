# Project Idea

This project is an interactive web visualization project. It will visualize network of researchers based on different modes of network data: co-authorship, co-citations and co-citing of their publications.

## Design layout

The application should have a single HTML and using JS backend like Vue.js and Bootstrap. 
- Main view shouöd have the network structure.
- On the left there should be a one controller to switch different network modes. When some nodes clicked it should provide details about that node from the meta-data. 
- On the right, there should be application specific configurations. This will cover project details, some high-level details about groups of users or publication details. Groups can be used to color nodes.
- When a node clicked on the network, their connections should be highlighted.
- Navbar header should have a logo and link for an about page. About page will open as a modal window.

## Data format

In this project there will be three main data types located under "data" folder: authors, publications, connections. Author and publication data contains standard bibliographic measures used for data analysis and visualization. Node size and colors can be determined by these fields. Connection are used to define different networks like co-authorship, co-citations and co-citing.

Example authors details that can be found in `authors.json.gz` file
```
{
	"A5031461158": {
		"orcid": "https://orcid.org/0000-0002-3994-6106", 
		"name": "Onur Varol", 
		"n_work": 94, 
		"n_citation": 4175, 
		"stat_h": 24, 
		"stat_i10": 33,
		"publications": ["w2595521492"]
	}
}
```


Example publication details can be found in `publications.json.gz` file. These IDs also found within the publications field of authors data. It is a way to match author publications to this file.
```
{
	"w2595521492": {
		'doi': 'https://doi.org/10.1609/icwsm.v11i1.14871',
	 	'title': 'Online Human-Bot Interactions: Detection, Estimation, and Characterization',
	 	'year': 2017,
	 	'authors': [
	 	  {'id': 'a5031461158',
	   		'name': 'Onur Varol',
		    'orcid': '0000-0002-3994-6106'},
		  {'id': 'a5078699564',
		   	'name': 'Emilio Ferrara',
		   	'orcid': '0000-0002-1942-2831'},
		  	{'id': 'a5050099046', 'name': 'Clayton A. Davis', 'orcid': None},
		  {'id': 'a5021346979',
		   'name': 'Filippo Menczer',
		   'orcid': '0000-0003-4384-2876'},
		  {'id': 'a5011228873',
		   'name': 'Alessandro Flammini',
		   'orcid': '0000-0003-1670-9156'}
		 ],
	 	'n_citation': 880,
	 	'fwci': 210.1081
	 }
 }
```

Networks in the project are always connecting authors but the edge weights will represent different information such as co-authorship, co-citations and co-citing. There are different files in the form of edge lists.

```
a5031461158,a5078699564,5
a5031461158,a5021346979,3
a5031461158,a5011228873,4
```

We also want to add a side panel where we can highlight multiple nodes together. They are application specific node groups. An example of this can be found in `groups.json` file.

```
{
    "description": "This file contains application specific node groups. ",
    "groups": [
        {
            "label": "Group 1",
            "nodes": ["a5031461158", "a5078699564", "a5021346979", "a5011228873"],
        },
		{
            "label": "Group 2",
            "nodes": ["a5031461158", "a5078699564", "a5021346979", "a5011228873"],
        }
    ]
}
```

## Implementation ideas

I like dark theme more as a default, but there can be a toggle option to change colors. Make sure colors in the network or other components adjust accourdingly.

Search bar can be added into the system, so users can look up certain authors easily.

When authors names are mentioned, there can be symbols to their orcid and openalex profiles.

I want this platform to be extendable for other project, so the menu on the left should be easy to customize for different meta-data.

TODO:
- Group description should be displayed on the left panel as a small note
- Check network type buttons have highlight effect for active data type