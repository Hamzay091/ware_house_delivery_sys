import os
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime, timedelta
from bson.objectid import ObjectId 
load_dotenv()

def run_inventory_forecast():
   
    print("--- Starting Robust Inventory Forecast Task (Corrected) ---")
    try:
        client = MongoClient(os.getenv('MONGO_URI'))
        db = client.get_database('warehouseDB')
        items_collection = db.items
        deliveries_collection = db.deliveries
        client.admin.command('ping')
        print(" Database connection successful.")
    except Exception as e:
        print(f" CRITICAL ERROR: Could not connect to MongoDB. Error: {e}")
        return

    try:
        print("\nStep 1: Fetching all sales data from delivered orders...")
        
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        sales_pipeline = [
            {'$match': {'status': 'Delivered', 'createdAt': {'$gte': thirty_days_ago}}},
            {'$unwind': '$items'},
            {'$group': {'_id': '$items.itemId', 'totalSold': {'$sum': '$items.quantity'}}}
        ]
        
        sales_results = list(deliveries_collection.aggregate(sales_pipeline))
        
        sales_data = {result['_id']: result['totalSold'] for result in sales_results}
        
        if not sales_data:
            print("No delivered sales data found in the last 30 days. Cannot run forecast.")
            client.close()
            return
            
        print(f"Found sales data for {len(sales_data)} unique items.")

        print("\nStep 2: Updating inventory items with forecast data...")
        
        all_items = list(items_collection.find({}))
        if not all_items:
            print("No items found in inventory.")
            client.close()
            return

        updated_count = 0
        for item in all_items:
            total_sold = sales_data.get(item['_id'], 0)
            daily_burn_rate = total_sold / 30.0

            if item.get('availableStock', 0) <= 0:
                days_of_stock_left = 0.0
            elif daily_burn_rate > 0:
                days_of_stock_left = item.get('availableStock', 0) / daily_burn_rate
            else:
                days_of_stock_left = 9999 

            update_result = items_collection.update_one(
                {'_id': item['_id']},
                {'$set': {
                    'forecast': {
                        'dailyBurnRate': round(daily_burn_rate, 2),
                        'daysOfStockLeft': round(days_of_stock_left, 1),
                        'lastUpdated': datetime.utcnow()
                    }
                }}
            )

            if update_result.modified_count > 0:
                updated_count += 1
                if total_sold > 0:
                    print(f"  - Updated forecast for '{item['name']}' (SKU: {item['sku']}): {round(daily_burn_rate, 2)} units/day.")
        
        print(f"\n Forecast complete. Updated {updated_count} of {len(all_items)} items.")

    except Exception as e:
        print(f"An error occurred during the forecast process: {e}")
    finally:
        client.close()
        print("--- Inventory Forecast Task Finished ---")

if __name__ == '__main__':
    run_inventory_forecast()