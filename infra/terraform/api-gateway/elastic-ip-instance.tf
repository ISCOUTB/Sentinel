resource "aws_eip" "sentinel_eip" {
  instance = aws_instance.sentinel.id

  tags = {
    Name = "sentinel-eip"
  }
}
