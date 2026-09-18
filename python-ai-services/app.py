import os
import requests
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from scipy.spatial import distance

load_dotenv()
app = Flask(__name__)

POSITIONSTACK_API_KEY = os.getenv('POSITIONSTACK_API_KEY')

def get_coordinates(address):
    """
    Geocodes an address using the PositionStack API with detailed logging.
    """
    print("\n--- Starting Geocoding for a New Address ---")
    print(f"Attempting to find coordinates for: '{address}'")

    if not POSITIONSTACK_API_KEY:
        print("❌ FATAL ERROR: POSITIONSTACK_API_KEY is not set or found in the .env file.")
        return None
    print("✅ API Key loaded successfully.")

    api_url = "http://api.positionstack.com/v1/forward"
    params = {
        'access_key': POSITIONSTACK_API_KEY,
        'query': address
    }

    print("Sending request to PositionStack...")

    try:
        response = requests.get(api_url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        print("\n--- RAW RESPONSE FROM POSITIONSTACK ---")
        print(data)
        print("--- END OF RAW RESPONSE ---\n")

        if data and 'data' in data and len(data['data']) > 0:
            result = data['data'][0]
            if 'latitude' in result and 'longitude' in result:
                coords = [result['latitude'], result['longitude']]
                print(f"✅ SUCCESS: Extracted coordinates: {coords}")
                return coords
            else:
                print("❌ ERROR: Response was successful, but latitude or longitude is missing.")
                return None
        else:
            
            if 'error' in data:
                error_info = data['error']
                print(f"❌ ERROR: PositionStack API returned an error: Code {error_info.get('code')} - {error_info.get('message')}")
            else:
                print("❌ ERROR: No valid data found for the address in the response.")
            return None

    except requests.exceptions.RequestException as e:
        print(f"❌ NETWORK ERROR: Failed to connect to PositionStack API: {e}")
        return None


def greedy_algorithm(addresses_with_coords):
    if not addresses_with_coords: return []
    addr_map = {i: addr for i, addr in enumerate(addresses_with_coords)}
    route_order = []
    current_index = 0
    route_order.append(addr_map.pop(current_index))
    while addr_map:
        min_dist = float('inf')
        next_index = None
        current_coords = route_order[-1]['coords']
        for index, addr_info in addr_map.items():
            dist = distance.euclidean(current_coords, addr_info['coords'])
            if dist < min_dist:
                min_dist = dist
                next_index = index
        route_order.append(addr_map.pop(next_index))
    return route_order

@app.route('/optimize-route', methods=['POST'])
def optimize_route():
    data = request.get_json()
    if not data or 'addresses' not in data:
        return jsonify({"message": "Invalid input. 'addresses' key is required."}), 400
    
    addresses_with_coords = []
    for addr_info in data['addresses']:
        coords = get_coordinates(addr_info['address'])
        if coords:
            addresses_with_coords.append({"address": addr_info['address'], "coords": coords})
    
    optimizable_addresses = [addr for addr in addresses_with_coords if addr.get('coords')]
    if not optimizable_addresses:
        return jsonify({"message": "Could not find coordinates for any of the provided addresses."}), 400
        
    optimized_route = greedy_algorithm(optimizable_addresses)
    
    return jsonify({"optimized_route": optimized_route})

if __name__ == '__main__':
    app.run(port=5001, debug=True)