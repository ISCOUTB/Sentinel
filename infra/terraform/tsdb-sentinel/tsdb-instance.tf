# Timestream InfluxDB Instance
resource "aws_timestreaminfluxdb_db_instance" "influxdb_instance" {
  name              = var.db_instance_name
  username          = var.db_username
  password          = var.db_password
  organization      = var.organization_name
  bucket            = var.bucket_name
  allocated_storage = var.allocated_storage
  db_instance_type  = var.db_instance_type

  vpc_subnet_ids         = [aws_subnet.influxdb_public_subnet_1.id, aws_subnet.influxdb_public_subnet_2.id]
  vpc_security_group_ids = [aws_security_group.influxdb_sg.id]

  publicly_accessible = var.publicly_accessible

  tags = {
    Name = "timestream-influxdb-instance"
  }
}
