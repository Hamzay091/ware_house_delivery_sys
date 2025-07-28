import os
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime, timedelta
from bson.objectid import ObjectId

def run_super_diagnostic():
    load_dotenv()
    print("--- Starting Super-Diagnostic Test ---")
    
    try:
        client = MongoClient(os.getenv('MONGO_URI'))
        db = client.get_database('warehouseDB')
        deliveries_collection = db.deliveries
        items_collection = db.items
        client.admin.command('ping')
        print("✅ Database connection successful.")
    except Exception as e:
        print(f"❌ CRITICAL ERROR: Could not connect to MongoDB. Error: {e}")
        return

    try:
        # 1. Find a single, specific item that we KNOW was delivered.
        print("\nStep 1: Finding a sample delivered item...")
        delivered_order = deliveries_collection.find_one({'status': 'Delivered'})
        
        if not delivered_order or not delivered_order.get('items'):
            print("\nDIAGNOSIS FAILED: No deliveries with status 'Delivered' containing items were found in the database.")
            print("Please ensure you have at least one delivery marked 'Delivered' with items in it.")
            return
            
        target_item_id = delivered_order['items'][0]['itemId']
        print(f"Found a target item from a delivered order. Item ID: {target_item_id}")
        print(f"Type of this ID is: {type(target_item_id)}")

        # 2. Find the reference time from the latest delivery.
        latest_delivery = deliveries_collection.find_one(sort=[('createdAt', -1)])
        now_reference = latest_delivery['createdAt']
        thirty_days_ago = now_reference - timedelta(days=30)
        print(f"\nStep 2: Time window is set correctly. Querying for items delivered after: {thirty_days_ago}")

        # 3. Build the EXACT same query pipeline the real script uses.
        print("\nStep 3: Simulating the AI forecaster's query for this single item...")
        
        delivery_pipeline = [
            {
                '$match': {
                    'createdAt': {'$gte': thirty_days_ago},
                    'items.itemId': target_item_id, # Use the ID we found
                    'status': 'Delivered'
                }
            },
            {'$unwind': '$items'},
            {'$match': {'items.itemId': target_item_id}},
            {'$group': {'_id': '$items.itemId', 'totalSold': {'$sum': '$items.quantity'}}}
        ]

        # 4. Execute the query and print the raw result.
        result = list(deliveries_collection.aggregate(delivery_pipeline))
        print("\n--- QUERY RESULT ---")
        print(result)
        print("--- END OF RESULT ---")

        # 5. Final Conclusion
        print("\n--- FINAL DIAGNOSIS ---")
        if result and result[0]['totalSold'] > 0:
            print(f"✅ SUCCESS: The query correctly found {result[0]['totalSold']} delivered units for the target item.")
            print("This means the problem is not in the query itself, but somewhere else in the forecaster's loop.")
        else:
            print("❌ FAILURE: The query found 0 delivered units for the target item.")
            print("This is the root of the problem. The database is not matching the 'itemId' between the 'items' and 'deliveries' collections.")
            print("This almost always indicates a data type mismatch (e.g., String vs. ObjectId).")
        print("----------------------")


    except Exception as e:
        print(f"\n❌ An error occurred during the diagnostic: {e}")
    finally:
        client.close()
        print("\n--- Super-Diagnostic Finished ---")

if __name__ == '__main__':
    run_super_diagnostic()