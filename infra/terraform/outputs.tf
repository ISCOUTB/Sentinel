output "instance_id" {
  description = "ID de instancia EC2"
  value       = aws_instance.sentinel.id
}

output "elastic_ip" {
  description = "Elastic IP asociada a la instancia Sentinel"
  value       = aws_eip.sentinel_eip.public_ip
}