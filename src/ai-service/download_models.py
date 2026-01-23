"""
Script to download CatVTON model from Hugging Face
Run this before starting the service for the first time
"""

import os
from huggingface_hub import snapshot_download

MODELS_DIR = os.environ.get('MODELS_DIR', './models')

def download_catvton():
    """Download CatVTON model"""
    print("📥 Downloading CatVTON model from Hugging Face...")
    
    try:
        # Download CatVTON model
        snapshot_download(
            repo_id="zhengchong/CatVTON",
            local_dir=os.path.join(MODELS_DIR, "catvton"),
            local_dir_use_symlinks=False,
            resume_download=True
        )
        print("✅ CatVTON model downloaded successfully!")
        
        # Download required SDXL VAE
        print("📥 Downloading SDXL VAE...")
        snapshot_download(
            repo_id="stabilityai/sdxl-vae",
            local_dir=os.path.join(MODELS_DIR, "sdxl-vae"),
            local_dir_use_symlinks=False,
            resume_download=True
        )
        print("✅ SDXL VAE downloaded successfully!")
        
        # Download CLIP model
        print("📥 Downloading CLIP model...")
        snapshot_download(
            repo_id="openai/clip-vit-large-patch14",
            local_dir=os.path.join(MODELS_DIR, "clip"),
            local_dir_use_symlinks=False,
            resume_download=True
        )
        print("✅ CLIP model downloaded successfully!")
        
    except Exception as e:
        print(f"❌ Error downloading model: {e}")
        raise

def download_idm_vton():
    """Download IDM-VTON model (alternative)"""
    print("📥 Downloading IDM-VTON model from Hugging Face...")
    
    try:
        snapshot_download(
            repo_id="yisol/IDM-VTON",
            local_dir=os.path.join(MODELS_DIR, "idm-vton"),
            local_dir_use_symlinks=False,
            resume_download=True
        )
        print("✅ IDM-VTON model downloaded successfully!")
        
    except Exception as e:
        print(f"❌ Error downloading model: {e}")
        raise

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Download virtual try-on models')
    parser.add_argument('--model', choices=['catvton', 'idm-vton', 'all'], 
                        default='catvton', help='Model to download')
    args = parser.parse_args()
    
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    if args.model in ['catvton', 'all']:
        download_catvton()
    
    if args.model in ['idm-vton', 'all']:
        download_idm_vton()
    
    print("\n✅ All models downloaded!")
    print(f"📁 Models directory: {os.path.abspath(MODELS_DIR)}")
