variable "thing_name" {
  description = "Nombre del dispositivo IoT (USV)"
  type        = string
}

variable "iot_policy_name" {
  description = "Nombre de la política IoT"
  type        = string
  default     = "usv-iot-policy"
}