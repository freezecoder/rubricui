import requests
import json

def test_api_debug():
    base_url = "http://localhost:8000"
    
    print("Testing API endpoints...")
    
    # Test rules endpoint with detailed output
    print("\n1. Testing /api/rules")
    try:
        response = requests.get(f"{base_url}/api/rules")
        print(f"Status: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        print(f"Content length: {len(response.content)}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"Parsed JSON: {len(data)} items")
                if data:
                    print(f"First item keys: {list(data[0].keys())}")
            except json.JSONDecodeError as e:
                print(f"JSON decode error: {e}")
                print(f"Raw response: {response.text[:200]}...")
        else:
            print(f"Error response: {response.text}")
    except Exception as e:
        print(f"Request error: {e}")
    
    # Test projects endpoint
    print("\n2. Testing /api/projects")
    try:
        response = requests.get(f"{base_url}/api/projects")
        print(f"Status: {response.status_code}")
        print(f"Content length: {len(response.content)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Projects found: {len(data)}")
    except Exception as e:
        print(f"Request error: {e}")

if __name__ == "__main__":
    test_api_debug()