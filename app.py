import os
from flask import Flask, render_template, jsonify, request, url_for
from pymongo import MongoClient
from datetime import datetime
from bson.objectid import ObjectId
from dotenv import load_dotenv
import qrcode
from io import BytesIO
import base64
from urllib.parse import urlencode

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')

# MongoDB connection
client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017/'))
db = client[os.getenv('MONGO_DB_NAME', 'donation_app')]
donations = db.donations

# Create index
donations.create_index("timestamp")

# ============================================
# KHQR INFO
# ============================================
KHQR_INFO = {
    'name': 'EL SOKTHANAROTH',
    'type': 'Member of KHQR',
    'hotline': '087853239',
    'image_filename': 'KHQR.jpg'
}

# ============================================
# ABA STATIC LINK (Your existing link)
# ============================================
ABA_STATIC_LINK = "https://link.payway.com.kh/aba"
ABA_PARAMS = {
    'id': '58355315E753',
    'dynamic': 'true',
    'source_caller': 'sdk',
    'pid': 'af_app_invites',
    'link_action': 'abaqr',
    'shortlink': 'w6oqbg7l',
    'usdAcc': '500113895',
    'created_from_app': 'true',
    'acc': '601121772',
    'af_siteid': '968860649',
    'userid': '58355315E753',
    'khrAcc': '601121772',
    'code': '096812',
    'c': 'abaqr',
    'af_referrer_uid': '1612001769086-2722499'
}
@app.route('/api/db-status')
def db_status():
    try:
        # Simple ping to MongoDB
        client.admin.command('ping')

        # Get collection stats
        total = donations.count_documents({})

        return jsonify({
            "success": True,
            "message": "MongoDB connected successfully",
            "total_donations": total
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "message": "MongoDB connection failed",
            "error": str(e)
        }), 500

def get_aba_static_url():
    """Return the static ABA URL without amount parameter"""
    return f"{ABA_STATIC_LINK}?{urlencode(ABA_PARAMS)}"

def generate_aba_qr():
    """Generate QR code for static ABA link"""
    try:
        aba_url = get_aba_static_url()
        
        qr = qrcode.QRCode(version=5, box_size=10, border=4)
        qr.add_data(aba_url)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return {
            'qr_code': f'data:image/png;base64,{img_str}',
            'url': aba_url
        }
    except Exception as e:
        print(f"QR Error: {e}")
        return None

# ============================================
# ROUTES
# ============================================

@app.route('/')
def index():
    """Main page"""
    khqr_info_with_url = KHQR_INFO.copy()
    khqr_info_with_url['image_url'] = url_for('static', filename=f'images/{KHQR_INFO["image_filename"]}')
    khqr_info_with_url['aba_static_url'] = get_aba_static_url()
    
    return render_template('index.html', khqr_info=khqr_info_with_url)

@app.route('/api/create-donation', methods=['POST'])
def create_donation():
    """Save donation and return payment info"""
    try:
        data = request.json
        name = data.get('name', '').strip()
        amount = float(data.get('amount', 0))
        
        if not name or amount < 0.01:
            return jsonify({'success': False, 'error': 'Invalid input'}), 400
        
        # Save to MongoDB
        donation = {
            'name': name,
            'amount': round(amount, 2),
            'timestamp': datetime.utcnow(),
            'status': 'pending',
            'payment_method': 'ABA PayWay (Manual Entry)'
        }
        
        result = donations.insert_one(donation)
        donation_id = str(result.inserted_id)
        
        # Generate QR for static ABA link
        aba_qr = generate_aba_qr()
        
        # Get image URL
        image_url = url_for('static', filename=f'images/{KHQR_INFO["image_filename"]}')
        
        return jsonify({
            'success': True,
            'donation_id': donation_id,
            'khqr_image': image_url,
            'aba_qr': aba_qr,
            'aba_static_url': get_aba_static_url(),
            'khqr_info': {
                'name': KHQR_INFO['name'],
                'type': KHQR_INFO['type'],
                'hotline': KHQR_INFO['hotline']
            },
            'amount': amount,
            'name': name
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/get-donations', methods=['GET'])
def get_donations():
    """Get completed donations"""
    try:
        cursor = donations.find({'status': 'completed'}).sort('timestamp', -1).limit(50)
        
        donation_list = []
        for doc in cursor:
            doc['id'] = str(doc['_id'])
            del doc['_id']
            if 'timestamp' in doc and isinstance(doc['timestamp'], datetime):
                doc['timestamp'] = doc['timestamp'].isoformat()
            donation_list.append(doc)
        
        return jsonify({'success': True, 'donations': donation_list})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/confirm-payment/<donation_id>', methods=['POST'])
def confirm_payment(donation_id):
    """Confirm payment"""
    try:
        result = donations.update_one(
            {'_id': ObjectId(donation_id)},
            {'$set': {'status': 'completed', 'completed_at': datetime.utcnow()}}
        )
        
        if result.matched_count == 0:
            return jsonify({'success': False, 'error': 'Not found'}), 404
        
        return jsonify({'success': True})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 ABA PAYWAY - MANUAL AMOUNT ENTRY")
    print("=" * 60)
    print(f"👤 Account: {KHQR_INFO['name']}")
    print(f"📞 Hotline: {KHQR_INFO['hotline']}")
    print("=" * 60)
    print("📝 SOLUTION 3: Manual Amount Entry")
    print("   Users will manually enter the amount in ABA app")
    print("=" * 60)
    print("🌐 Server: http://localhost:5000")
    print("=" * 60)
    
    app.run(debug=True, port=5000)
    