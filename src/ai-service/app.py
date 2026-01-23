"""
CatVTON AI Service - Virtual Try-On API
Flask-based REST API for virtual try-on using CatVTON model
"""

import os
import io
import time
import base64
import requests
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS

import torch
from diffusers import AutoencoderKL
from transformers import CLIPImageProcessor, CLIPVisionModelWithProjection

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Global model variables
model = None
device = None
model_loaded = False

def load_model():
    """Load CatVTON model"""
    global model, device, model_loaded
    
    print("🔄 Loading CatVTON model...")
    
    # Check for GPU
    if torch.cuda.is_available():
        device = torch.device("cuda")
        print(f"✅ Using GPU: {torch.cuda.get_device_name(0)}")
    else:
        device = torch.device("cpu")
        print("⚠️ GPU not available, using CPU (will be slow)")
    
    try:
        # Import CatVTON specific modules
        # Note: You may need to clone the CatVTON repo and adjust imports
        from catvton import CatVTONPipeline
        
        model = CatVTONPipeline.from_pretrained(
            "zhengchong/CatVTON",
            torch_dtype=torch.float16 if device.type == "cuda" else torch.float32
        ).to(device)
        
        model_loaded = True
        print("✅ Model loaded successfully!")
        
    except ImportError:
        print("⚠️ CatVTON not installed. Using mock model for testing.")
        model_loaded = True  # Mock for testing
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        model_loaded = False

def download_image(url_or_base64):
    """Download image from URL or decode from base64"""
    if url_or_base64.startswith('data:image'):
        # Base64 image
        header, data = url_or_base64.split(',', 1)
        image_data = base64.b64decode(data)
        return Image.open(io.BytesIO(image_data)).convert('RGB')
    elif url_or_base64.startswith('http'):
        # URL
        response = requests.get(url_or_base64, timeout=30)
        response.raise_for_status()
        return Image.open(io.BytesIO(response.content)).convert('RGB')
    else:
        raise ValueError("Invalid image format. Must be URL or base64.")

def image_to_base64(image):
    """Convert PIL Image to base64 string"""
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    buffer.seek(0)
    return 'data:image/png;base64,' + base64.b64encode(buffer.read()).decode()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'model_loaded': model_loaded,
        'gpu_available': torch.cuda.is_available(),
        'gpu_name': torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
    })

@app.route('/api/tryon', methods=['POST'])
def generate_tryon():
    """Generate virtual try-on image"""
    start_time = time.time()
    
    if not model_loaded:
        return jsonify({
            'error': 'Model not loaded. Please check logs.'
        }), 503
    
    try:
        data = request.get_json()
        
        # Validate required fields
        person_image_input = data.get('person_image')
        garment_image_input = data.get('garment_image')
        
        if not person_image_input or not garment_image_input:
            return jsonify({
                'error': 'Both person_image and garment_image are required'
            }), 400
        
        # Get optional parameters
        category = data.get('category', 'full-body')
        denoise_steps = min(data.get('denoise_steps', 30), 50)  # Cap at 50
        seed = data.get('seed', -1)
        
        # Download/decode images
        person_image = download_image(person_image_input)
        garment_image = download_image(garment_image_input)
        
        # Resize images to model input size
        target_size = (768, 1024)  # Width x Height
        person_image = person_image.resize(target_size, Image.LANCZOS)
        garment_image = garment_image.resize((768, 768), Image.LANCZOS)
        
        # Generate try-on
        if model is not None:
            # Real model inference
            with torch.inference_mode():
                if seed >= 0:
                    generator = torch.Generator(device=device).manual_seed(seed)
                else:
                    generator = None
                
                result = model(
                    person_image=person_image,
                    garment_image=garment_image,
                    num_inference_steps=denoise_steps,
                    generator=generator
                )
                
                output_image = result.images[0]
        else:
            # Mock result for testing (blend images)
            print("⚠️ Using mock generation (model not loaded)")
            output_image = Image.blend(
                person_image.resize((768, 1024)), 
                garment_image.resize((768, 1024)), 
                alpha=0.3
            )
        
        processing_time = int((time.time() - start_time) * 1000)
        
        # Convert to base64
        output_base64 = image_to_base64(output_image)
        
        return jsonify({
            'output_image': output_base64,
            'model_version': 'catvton-v1',
            'processing_time_ms': processing_time,
            'category': category
        })
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': f'Failed to download image: {str(e)}'
        }), 400
    except Exception as e:
        print(f"❌ Error generating try-on: {e}")
        return jsonify({
            'error': str(e)
        }), 500

@app.route('/api/tryon/batch', methods=['POST'])
def generate_tryon_batch():
    """Generate multiple try-on images (for outfit preview)"""
    # Placeholder for batch processing
    return jsonify({
        'error': 'Batch processing not implemented yet'
    }), 501

if __name__ == '__main__':
    # Load model on startup
    load_model()
    
    # Run Flask app
    port = int(os.environ.get('PORT', 7860))
    print(f"🚀 Starting CatVTON service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
