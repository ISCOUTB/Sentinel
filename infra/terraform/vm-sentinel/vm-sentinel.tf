resource "aws_key_pair" "sentinel_ec2_key_pair" {
  key_name   = "mykey"
  public_key = file("${path.module}/../mykey.pub")
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

  user_data = templatefile("${path.module}/scripts/user_data.sh", {
    branch              = var.repo_branch
    user_pool_id        = var.user_pool_id
    user_pool_client_id = var.user_pool_client_id
    aws_iot_endpoint    = var.aws_iot_endpoint
    iot_certificate_pem = var.iot_certificate_pem
    iot_private_key     = var.iot_private_key
    influxdb_url        = var.influxdb_url
    influxdb_org        = var.influxdb_org
    influxdb_username   = var.influxdb_username
    influxdb_password   = var.influxdb_password
    influxdb_bucket     = var.influxdb_bucket
    topic_bucket_map    = var.topic_bucket_map
    secret_key          = var.secret_key
    mysql_root_password = var.mysql_root_password
    mysql_user          = var.mysql_user
    mysql_password      = var.mysql_password
    mysql_database      = var.mysql_database
  })

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