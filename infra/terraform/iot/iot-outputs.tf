output "thing_name" {
  value = aws_iot_thing.usv.name
}

output "certificate_pem" {
  value     = aws_iot_certificate.usv_cert.certificate_pem
  sensitive = true
}

output "private_key" {
  value     = aws_iot_certificate.usv_cert.private_key
  sensitive = true
}
