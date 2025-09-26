#!/bin/bash

# Stok Yönetim Sistemi - Docker Deployment Script
# Bu script projenizi Docker ile deploy etmenizi sağlar

set -e  # Exit on any error

echo "🚀 Stok Yönetim Sistemi - Docker Deployment"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="stok-yonetim"
CONTAINER_NAME="stok-yonetim-app"
PORT="3000"

# Functions
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is installed
check_docker() {
    print_status "Docker kontrolü yapılıyor..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker bulunamadı! Lütfen Docker'ı yükleyin."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker çalışmıyor! Lütfen Docker'ı başlatın."
        exit 1
    fi
    
    print_success "Docker hazır"
}

# Check if Docker Compose is available
check_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        print_warning "Docker Compose bulunamadı, standart Docker kullanılacak"
        return 1
    fi
    return 0
}

# Stop and remove existing container
cleanup_existing() {
    print_status "Mevcut container kontrol ediliyor..."
    
    if docker ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        print_status "Mevcut container durduruluyor..."
        docker stop $CONTAINER_NAME || true
        docker rm $CONTAINER_NAME || true
        print_success "Mevcut container temizlendi"
    fi
    
    # Clean up old images
    if docker images | grep -q "^${IMAGE_NAME}"; then
        print_status "Eski image'lar temizleniyor..."
        docker rmi $IMAGE_NAME || true
    fi
}

# Build Docker image
build_image() {
    print_status "Docker image oluşturuluyor..."
    docker build -t $IMAGE_NAME . || {
        print_error "Docker build başarısız!"
        exit 1
    }
    print_success "Docker image oluşturuldu: $IMAGE_NAME"
}

# Run container
run_container() {
    print_status "Container başlatılıyor..."
    docker run -d \
        --name $CONTAINER_NAME \
        -p $PORT:80 \
        --restart unless-stopped \
        $IMAGE_NAME || {
        print_error "Container başlatılamadı!"
        exit 1
    }
    print_success "Container başlatıldı: $CONTAINER_NAME"
}

# Run with Docker Compose
run_compose() {
    print_status "Docker Compose ile başlatılıyor..."
    $COMPOSE_CMD down || true
    $COMPOSE_CMD up -d --build || {
        print_error "Docker Compose başarısız!"
        exit 1
    }
    print_success "Docker Compose ile başlatıldı"
}

# Health check
health_check() {
    print_status "Sağlık kontrolü yapılıyor..."
    
    # Wait for container to start
    sleep 5
    
    for i in {1..30}; do
        if curl -f http://localhost:$PORT &> /dev/null; then
            print_success "Uygulama başarıyla başlatıldı!"
            print_success "URL: http://localhost:$PORT"
            return 0
        fi
        print_status "Bekleniyor... ($i/30)"
        sleep 2
    done
    
    print_warning "Sağlık kontrolü başarısız, ancak uygulama çalışıyor olabilir"
    print_status "Manuel kontrol: http://localhost:$PORT"
}

# Show container status
show_status() {
    print_status "Container durumu:"
    docker ps | grep $CONTAINER_NAME || echo "Container bulunamadı"
    
    print_status "Logları görüntülemek için:"
    echo "docker logs $CONTAINER_NAME"
    
    print_status "Container'a bağlanmak için:"
    echo "docker exec -it $CONTAINER_NAME sh"
}

# Main deployment logic
main() {
    echo
    print_status "Deployment başlatılıyor..."
    
    # Pre-checks
    check_docker
    
    # Choose deployment method
    if check_docker_compose; then
        print_status "Docker Compose ile deployment yapılacak"
        run_compose
    else
        print_status "Standart Docker ile deployment yapılacak"
        cleanup_existing
        build_image
        run_container
    fi
    
    # Post-deployment checks
    health_check
    show_status
    
    echo
    print_success "🎉 Deployment tamamlandı!"
    print_success "🌐 Uygulama: http://localhost:$PORT"
    echo
}

# Handle script arguments
case "${1:-}" in
    "build")
        check_docker
        build_image
        ;;
    "start")
        check_docker
        run_container
        ;;
    "stop")
        docker stop $CONTAINER_NAME || true
        print_success "Container durduruldu"
        ;;
    "restart")
        docker restart $CONTAINER_NAME || true
        print_success "Container yeniden başlatıldı"
        ;;
    "logs")
        docker logs -f $CONTAINER_NAME
        ;;
    "clean")
        cleanup_existing
        print_success "Temizlik tamamlandı"
        ;;
    "status")
        show_status
        ;;
    "help"|"-h"|"--help")
        echo "Kullanım: $0 [komut]"
        echo
        echo "Komutlar:"
        echo "  build   - Sadece image oluştur"
        echo "  start   - Sadece container başlat"
        echo "  stop    - Container'ı durdur"
        echo "  restart - Container'ı yeniden başlat"
        echo "  logs    - Container loglarını göster"
        echo "  clean   - Mevcut container'ı temizle"
        echo "  status  - Container durumunu göster"
        echo "  help    - Bu yardım mesajını göster"
        echo
        echo "Parametre olmadan çalıştırırsanız tam deployment yapılır."
        ;;
    "")
        main
        ;;
    *)
        print_error "Bilinmeyen komut: $1"
        print_status "Yardım için: $0 help"
        exit 1
        ;;
esac