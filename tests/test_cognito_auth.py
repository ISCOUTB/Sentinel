import boto3
import sys

def test_cognito():
    client = boto3.client('cognito-idp', region_name='us-east-1')
    try:
        response = client.initiate_auth(
            ClientId='2i6r6a7hi79epi20b5uedgeo1e',
            AuthFlow='USER_PASSWORD_AUTH',
            AuthParameters={
                'USERNAME': 'test_user',
                'PASSWORD': 'test_password'
            }
        )
        print("Success:", response)
    except Exception as e:
        print("Cognito Error:", str(e))

if __name__ == "__main__":
    test_cognito()
