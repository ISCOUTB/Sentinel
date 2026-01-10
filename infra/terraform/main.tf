terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16"
    }
  }
  required_version = ">= 1.2.0"
}

provider "aws" {
  access_key = var.my_access_key
  secret_key = var.my_secret_key
  region     = var.region_sentinel
}

resource "aws_key_pair" "sentinel_ec2_key_pair" {
  key_name   = "mykey"
  public_key = file("mykey.pub")
}

resource "aws_security_group" "docker_sg" {
  name        = "docker-sg"
  description = "Security group para permitir SSH y HTTP"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 8081
    to_port     = 8081
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

data "aws_ami" "ubuntu_22_04" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

resource "aws_instance" "sentinel" {
  ami                    = data.aws_ami.ubuntu_22_04.id
  instance_type          = "t3.medium"
  key_name               = aws_key_pair.sentinel_ec2_key_pair.key_name
  vpc_security_group_ids = [aws_security_group.docker_sg.id]

  tags = {
    Name = "SentinelInstance"
  }

  depends_on = [aws_security_group.docker_sg]

  user_data = <<-EOF
    #!/bin/bash
    set -e

    # Actualizar sistema
    apt-get update -y
    apt-get upgrade -y

    # Dependencias
    apt-get install -y ca-certificates curl gnupg git

    # Instalar Docker (método estable)
    curl -fsSL https://get.docker.com | sh

    # Habilitar Docker
    systemctl enable docker
    systemctl start docker

    # Instalar docker-compose v1 (NO v2)
    curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" \
    -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose

    # Permisos usuario ubuntu
    usermod -aG docker ubuntu

    # Esperar a Docker
    sleep 30

    # Clonar repo
    cd /home/ubuntu
    git clone -b instance-vm https://github.com/ISCOUTB/Sentinel.git
    chown -R ubuntu:ubuntu Sentinel

    # Desactivar BuildKit (CRÍTICO)
    #export DOCKER_BUILDKIT=0
    #export COMPOSE_DOCKER_CLI_BUILD=0

    # Levantar contenedores DESDE LA RUTA CORRECTA
    cd ~/Sentinel/infra/docker
    /usr/local/bin/docker-compose up -d --build
  EOF

}