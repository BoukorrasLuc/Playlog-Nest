import { 
    IsEmail,
    IsString,
    MinLength, 
    MaxLength,
    Matches,
    IsNotEmpty
  } from "class-validator";
  
  export class SignupDto {
  
    @IsEmail()
    @IsNotEmpty()
    readonly email: string;
  
    @IsNotEmpty()
    @IsString()
    @MinLength(8)
    @MaxLength(20) 
    @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
      message: 'password too weak' 
    })
    readonly password: string;
  
    @IsNotEmpty()
    @IsString()
    @MinLength(3)
    @MaxLength(20)
    readonly pseudo: string;
  
  }