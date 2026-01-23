# CatVTON AI Service for FARE Virtual Try-On

Đây là AI service container sử dụng CatVTON model cho virtual try-on.

## Yêu cầu hệ thống

- **GPU**: NVIDIA GPU với 8GB+ VRAM (RTX 3060, RTX 4060, hoặc tốt hơn)
- **NVIDIA Driver**: 525.60.13+
- **Docker**: 20.10+
- **NVIDIA Container Toolkit**: Đã cài đặt

## Cài đặt NVIDIA Container Toolkit

### Windows (WSL2)
```powershell
# Cài WSL2 với Ubuntu
wsl --install

# Trong Ubuntu WSL2:
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
```

### Linux
```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

## Chạy AI Service

### Option 1: Docker Compose (Khuyến nghị)
```bash
cd src/ai-service
docker-compose up -d
```

### Option 2: Docker command trực tiếp
```bash
docker run -d --gpus all \
    -p 7860:7860 \
    -v ./models:/app/models \
    --name catvton-service \
    fare/catvton-service:latest
```

## API Endpoints

### POST /api/tryon
Generate try-on image

**Request Body:**
```json
{
    "person_image": "https://...",  // URL hoặc base64
    "garment_image": "https://...", // URL hoặc base64
    "category": "full-body",        // upper, lower, full-body
    "denoise_steps": 30,
    "seed": -1
}
```

**Response:**
```json
{
    "output_image": "data:image/png;base64,...",
    "model_version": "catvton-v1",
    "processing_time_ms": 5000
}
```

### GET /health
Health check

**Response:**
```json
{
    "status": "ok",
    "model_loaded": true,
    "gpu_available": true
}
```

## Troubleshooting

### "CUDA out of memory"
- Giảm `denoise_steps` xuống 20
- Resize ảnh input nhỏ hơn (768x768)

### "Model loading failed"
- Kiểm tra dung lượng ổ đĩa (model ~4GB)
- Kiểm tra kết nối internet khi lần đầu download model

### Container không start
```bash
# Check logs
docker logs catvton-service

# Check GPU
nvidia-smi
```
