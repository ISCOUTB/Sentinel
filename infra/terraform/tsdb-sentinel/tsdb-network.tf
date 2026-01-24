# VPC
resource "aws_vpc" "influxdb_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "influxdb-vpc"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "influxdb_igw" {
  vpc_id = aws_vpc.influxdb_vpc.id

  tags = {
    Name = "influxdb-igw"
  }
}

# Subnets públicas
resource "aws_subnet" "influxdb_public_subnet_1" {
  vpc_id                  = aws_vpc.influxdb_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name = "influxdb-public-subnet-1"
  }
}

resource "aws_subnet" "influxdb_public_subnet_2" {
  vpc_id                  = aws_vpc.influxdb_vpc.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true

  tags = {
    Name = "influxdb-public-subnet-2"
  }
}

# Route Table
resource "aws_route_table" "influxdb_public_rt" {
  vpc_id = aws_vpc.influxdb_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.influxdb_igw.id
  }

  tags = {
    Name = "influxdb-public-rt"
  }
}

# Route Table Associations
resource "aws_route_table_association" "public_subnet_1_association" {
  subnet_id      = aws_subnet.influxdb_public_subnet_1.id
  route_table_id = aws_route_table.influxdb_public_rt.id
}

resource "aws_route_table_association" "public_subnet_2_association" {
  subnet_id      = aws_subnet.influxdb_public_subnet_2.id
  route_table_id = aws_route_table.influxdb_public_rt.id
}

# Security Group
resource "aws_security_group" "influxdb_sg" {
  name        = "influxdb-security-group"
  description = "Security group para InfluxDB"
  vpc_id      = aws_vpc.influxdb_vpc.id

  ingress {
    from_port   = 8086
    to_port     = 8086
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Ajusta según tus necesidades de seguridad
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "influxdb-sg"
  }
}

# Data source para availability zones
data "aws_availability_zones" "available" {
  state = "available"
}