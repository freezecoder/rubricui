import requests
import json

# Test the API endpoints
base_url = "http://localhost:8000"

def test_api():
    try:
        # Test root endpoint
        response = requests.get(f"{base_url}/")
        print(f"Root endpoint: {response.status_code} - {response.json()}")
        
        # Test rules endpoint
        response = requests.get(f"{base_url}/api/rules")
        print(f"Rules endpoint: {response.status_code}")
        if response.status_code == 200:
            rules = response.json()
            print(f"Found {len(rules)} rules")
            if rules:
                print(f"First rule: {rules[0]['name']}")
        else:
            print(f"Error: {response.text}")
        
        # Test projects endpoint
        response = requests.get(f"{base_url}/api/projects")
        print(f"Projects endpoint: {response.status_code}")
        if response.status_code == 200:
            projects = response.json()
            print(f"Found {len(projects)} projects")
            if projects:
                print(f"First project: {projects[0]['name']}")
        else:
            print(f"Error: {response.text}")
            
        # Test rubrics endpoint
        response = requests.get(f"{base_url}/api/rubrics")
        print(f"Rubrics endpoint: {response.status_code}")
        if response.status_code == 200:
            rubrics = response.json()
            print(f"Found {len(rubrics)} rubrics")
            if rubrics:
                print(f"First rubric: {rubrics[0]['name']}")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error testing API: {e}")

if __name__ == "__main__":
    test_api()