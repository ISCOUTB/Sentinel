resource "aws_key_pair" "sentinel_ec2_key_pair" {
  key_name   = "mykey"
  public_key = file("mykey.pub")
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
    secret_key          = var.secret_key
    mysql_root_password = var.mysql_root_password
    mysql_user          = var.mysql_user
    mysql_password      = var.mysql_password
    mysql_database      = var.mysql_database
  })

}