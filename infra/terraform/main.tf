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
    from_port   = 80
    to_port     = 80
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
  instance_type          = "t3.micro"
  key_name               = aws_key_pair.sentinel_ec2_key_pair.key_name
  vpc_security_group_ids = [aws_security_group.docker_sg.id]

  tags = {
    Name = "SentinelInstance"
  }

  depends_on = [aws_security_group.docker_sg]

  user_data = <<-EOF
    #!/bin/bash
    set -e

    apt-get update -y
    apt-get upgrade -y

    # Instalar dependencias
    apt-get install -y ca-certificates curl gnupg git

    # Instalar Docker
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      > /etc/apt/sources.list.d/docker.list

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

    # Habilitar Docker
    systemctl enable docker
    systemctl start docker

    # Usuario ubuntu
    usermod -aG docker ubuntu

    # Esperar a que Docker esté listo
    sleep 20

    cd /home/ubuntu

    # Clonar rama develop
    git clone -b develop https://github.com/ISCOUTB/Sentinel.git
    chown -R ubuntu:ubuntu Sentinel

    cd Sentinel

    # Levantar contenedores
    sudo docker compose up -d

  EOF

}